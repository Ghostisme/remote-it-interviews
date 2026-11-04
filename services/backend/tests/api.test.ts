/** Exercise real PostgreSQL rules through the Hono request boundary, validating published response contracts. */
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import * as Contracts from "../src/contracts";
import { connectDatabase } from "../src/db/client";
import { categories, customers, menuItems, settings } from "../src/db/schema";
import { calculateTotals } from "../src/domain/orders";
import "../scripts/env";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://odyssey:odyssey_local@127.0.0.1:55432/odyssey_test";
// Guard the destructive fixture reset before constructing the database connection.
if (new URL(testDatabaseUrl).pathname !== "/odyssey_test")
  throw new Error("Tests require the dedicated odyssey_test database.");
const { db, pool } = connectDatabase(testDatabaseUrl);
const app = createApp(db);
let customerId: string;
let menuItemId: string;
/** Send JSON through the same middleware, validators, and route handlers as the Worker. */
const requestApi = (path: string, method = "GET", data?: unknown) =>
  app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
/** Build an independent valid command so each new order receives a fresh idempotency key. */
const createOrderInput = () => ({
  customerId,
  fulfillment: "pickup" as const,
  idempotencyKey: crypto.randomUUID(),
  items: [{ menuItemId: menuItemId, quantity: 2 }],
});
beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
});
// Each scenario starts with isolated fixtures in odyssey_test; the review database stays intact.
beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE order_events, order_items, orders, menu_items, categories, customers, settings RESTART IDENTITY CASCADE`,
  );
  await db.insert(settings).values({ id: 1, taxRateBps: 825, deliveryFeeCents: 350 });
  const [category] = await db.insert(categories).values({ name: "Mains" }).returning();
  const [customer] = await db
    .insert(customers)
    .values({ name: "Test Customer", email: "test@example.com" })
    .returning();
  if (!category || !customer) throw new Error("Missing test fixture");
  const [item] = await db
    .insert(menuItems)
    .values({ name: "Test pasta", categoryId: category.id, priceCents: 1299 })
    .returning();
  if (!item) throw new Error("Missing test menu item");
  customerId = customer.id;
  menuItemId = item.id;
});
afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL-backed restaurant API", () => {
  it("returns responses matching the published contract", async () => {
    for (const [path, schema] of [
      ["/api/menu", Contracts.MenuList],
      ["/api/customers", Contracts.CustomerList],
      ["/api/orders", Contracts.OrderList],
      ["/api/settings", Contracts.Settings],
      ["/api/summary", Contracts.Summary],
    ] as const) {
      const result = await requestApi(path);
      expect(result.status, path).toBe(200);
      expect(schema.safeParse(await result.json()).success, path).toBe(true);
    }
  });
  it("calculates prices on the server and snapshots the original menu price", async () => {
    const result = await requestApi("/api/orders", "POST", createOrderInput());
    expect(result.status).toBe(201);
    const detail = Contracts.OrderDetail.parse(await result.json());
    expect(detail.order).toMatchObject({
      subtotalCents: 2598,
      taxCents: 214,
      totalCents: 2812,
      status: "pending",
    });
    await requestApi(`/api/menu/${menuItemId}`, "PATCH", { priceCents: 2000 });
    const stored = Contracts.OrderDetail.parse(
      await (await requestApi(`/api/orders/${detail.order.id}`)).json(),
    );
    expect(stored.items[0]?.unitPriceCents).toBe(1299);
    expect(stored.order).not.toHaveProperty("requestHash");
  });
  it("finds orders by the displayed number, padded number and customer name", async () => {
    const detail = Contracts.OrderDetail.parse(
      await (await requestApi("/api/orders", "POST", createOrderInput())).json(),
    );
    const number = String(detail.order.number);
    const padded = number.padStart(4, "0");
    for (const search of [
      number,
      padded,
      `#${padded}`,
      `#OE-${padded}`,
      `oe-${padded}`,
      "Customer",
    ]) {
      const result = await requestApi(`/api/orders?search=${encodeURIComponent(search)}`);
      expect(result.status).toBe(200);
      const list = Contracts.OrderList.parse(await result.json());
      expect(
        list.data.map((order) => order.id),
        search,
      ).toEqual([detail.order.id]);
      expect(list.pagination.total, search).toBe(1);
    }
    const missing = Contracts.OrderList.parse(
      await (await requestApi("/api/orders?search=%23OE-9999")).json(),
    );
    expect(missing.data).toEqual([]);
  });
  it("rejects invalid and forged input without creating orders", async () => {
    for (const value of [
      { ...createOrderInput(), totalCents: 1 },
      { ...createOrderInput(), items: [] },
      { ...createOrderInput(), items: [{ menuItemId: menuItemId, quantity: -1 }] },
      { ...createOrderInput(), fulfillment: "delivery" },
      {
        ...createOrderInput(),
        items: [
          { menuItemId: menuItemId, quantity: 1 },
          { menuItemId: menuItemId, quantity: 2 },
        ],
      },
    ]) {
      const result = await requestApi("/api/orders", "POST", value);
      expect(result.status).toBe(400);
      Contracts.ApiError.parse(await result.json());
    }
    const list = Contracts.OrderList.parse(await (await requestApi("/api/orders")).json());
    expect(list.pagination.total).toBe(0);
  });
  it("returns a typed client error for malformed JSON without creating orders", async () => {
    for (const body of ["{", "", '{"items":]']) {
      const result = await app.request("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(result.status).toBe(400);
      const error = Contracts.ApiError.parse(await result.json());
      expect(error.error.code).toBe("INVALID_JSON");
      expect(error.requestId).toBe(result.headers.get("X-Request-Id"));
    }
    const list = Contracts.OrderList.parse(await (await requestApi("/api/orders")).json());
    expect(list.pagination.total).toBe(0);
  });
  it("serializes concurrent retries and rejects reusing a key for different content", async () => {
    const payload = createOrderInput();
    // Both requests intentionally share one command to exercise database-level serialization.
    const results = await Promise.all([
      requestApi("/api/orders", "POST", payload),
      requestApi("/api/orders", "POST", payload),
    ]);
    const details = await Promise.all(
      results.map(async (response) => {
        expect(response.status).toBe(201);
        return Contracts.OrderDetail.parse(await response.json());
      }),
    );
    expect(details[0]?.order.id).toBe(details[1]?.order.id);
    const conflict = await requestApi("/api/orders", "POST", { ...payload, notes: "Different" });
    expect(conflict.status).toBe(409);
    const list = Contracts.OrderList.parse(await (await requestApi("/api/orders")).json());
    expect(list.pagination.total).toBe(1);
  });
  it("enforces availability, paused ordering, service flags and minimum spend", async () => {
    await requestApi(`/api/menu/${menuItemId}`, "PATCH", { available: false });
    expect((await requestApi("/api/orders", "POST", createOrderInput())).status).toBe(409);
    await requestApi(`/api/menu/${menuItemId}`, "PATCH", { available: true });
    await requestApi("/api/settings", "PATCH", { acceptingOrders: false });
    expect((await requestApi("/api/orders", "POST", createOrderInput())).status).toBe(409);
    await requestApi("/api/settings", "PATCH", { acceptingOrders: true, pickupEnabled: false });
    expect((await requestApi("/api/orders", "POST", createOrderInput())).status).toBe(409);
    await requestApi("/api/settings", "PATCH", { pickupEnabled: true, minimumOrderCents: 5000 });
    expect((await requestApi("/api/orders", "POST", createOrderInput())).status).toBe(400);
  });
  it("protects state transitions and updates CRM spend and dashboard revenue on completion", async () => {
    let detail = Contracts.OrderDetail.parse(
      await (await requestApi("/api/orders", "POST", createOrderInput())).json(),
    );
    expect(
      (
        await requestApi(`/api/orders/${detail.order.id}/actions`, "POST", {
          action: "complete",
          version: 0,
        })
      ).status,
    ).toBe(409);
    // Competing actions use the same version; exactly one may advance the locked order.
    const concurrent = await Promise.all(
      ["accept", "cancel"].map((action) =>
        requestApi(`/api/orders/${detail.order.id}/actions`, "POST", { action, version: 0 }),
      ),
    );
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409]);
    detail = Contracts.OrderDetail.parse(
      await (await requestApi(`/api/orders/${detail.order.id}`)).json(),
    );
    if (detail.order.status === "cancelled")
      detail = Contracts.OrderDetail.parse(
        await (await requestApi("/api/orders", "POST", createOrderInput())).json(),
      );
    for (const action of detail.order.status === "pending"
      ? ["accept", "prepare", "mark_ready", "complete"]
      : ["prepare", "mark_ready", "complete"]) {
      const result = await requestApi(`/api/orders/${detail.order.id}/actions`, "POST", {
        action,
        version: detail.order.version,
      });
      expect(result.status).toBe(200);
      detail = Contracts.OrderDetail.parse(await result.json());
    }
    expect(detail.allowedActions).toEqual([]);
    expect(detail.events.at(-1)?.status).toBe("completed");
    const customer = Contracts.CustomerDetail.parse(
      await (await requestApi(`/api/customers/${customerId}`)).json(),
    );
    expect(customer.customer.spendCents).toBe(2812);
    const summary = Contracts.Summary.parse(await (await requestApi("/api/summary")).json());
    expect(summary.revenueCents).toBe(2812);
    expect(summary.daily).toHaveLength(7);
  });
  it("archives dishes out of ordering and only deletes them without order history", async () => {
    expect((await requestApi(`/api/menu/${menuItemId}`, "DELETE")).status).toBe(409);
    await requestApi("/api/orders", "POST", createOrderInput());
    const archived = Contracts.MenuItem.parse(
      await (await requestApi(`/api/menu/${menuItemId}/archive`, "POST")).json(),
    );
    expect(archived.archivedAt).not.toBeNull();
    const rejected = await requestApi("/api/orders", "POST", createOrderInput());
    expect(rejected.status).toBe(409);
    expect(Contracts.ApiError.parse(await rejected.json()).error.code).toBe("ITEM_ARCHIVED");
    const kept = await requestApi(`/api/menu/${menuItemId}`, "DELETE");
    expect(Contracts.ApiError.parse(await kept.json()).error.code).toBe("ITEM_HAS_ORDERS");
    const restored = Contracts.MenuItem.parse(
      await (await requestApi(`/api/menu/${menuItemId}/restore`, "POST")).json(),
    );
    expect(restored.archivedAt).toBeNull();
    expect((await requestApi("/api/orders", "POST", createOrderInput())).status).toBe(201);

    const fresh = Contracts.MenuItem.parse(
      await (
        await requestApi("/api/menu", "POST", {
          name: "Unused special",
          categoryId: archived.categoryId,
          priceCents: 900,
          imageKey: "soup",
        })
      ).json(),
    );
    await requestApi(`/api/menu/${fresh.id}/archive`, "POST");
    expect((await requestApi(`/api/menu/${fresh.id}`, "DELETE")).status).toBe(204);
    const menu = Contracts.MenuList.parse(await (await requestApi("/api/menu")).json());
    expect(menu.items.map((item) => item.id)).toEqual([menuItemId]);
  });
  it("renames categories and deletes only empty ones", async () => {
    const menu = Contracts.MenuList.parse(await (await requestApi("/api/menu")).json());
    const mainsId = menu.categories[0]?.id;
    const renamed = await requestApi(`/api/categories/${mainsId}`, "PATCH", {
      name: "Large plates",
    });
    expect(Contracts.Category.parse(await renamed.json()).name).toBe("Large plates");
    expect((await requestApi(`/api/categories/${mainsId}`, "PATCH", { name: "x" })).status).toBe(
      400,
    );
    const blocked = await requestApi(`/api/categories/${mainsId}`, "DELETE");
    expect(Contracts.ApiError.parse(await blocked.json()).error.code).toBe("CATEGORY_NOT_EMPTY");
    const empty = Contracts.Category.parse(
      await (await requestApi("/api/categories", "POST", { name: "Seasonal" })).json(),
    );
    expect((await requestApi(`/api/categories/${empty.id}`, "DELETE")).status).toBe(204);
    expect((await requestApi(`/api/categories/${empty.id}`, "DELETE")).status).toBe(404);
  });
  it("validates pagination, unique emails and missing records", async () => {
    expect((await requestApi("/api/orders?pageSize=1000")).status).toBe(400);
    expect(
      (await requestApi("/api/customers", "POST", { name: "Duplicate", email: "test@example.com" }))
        .status,
    ).toBe(409);
    expect((await requestApi(`/api/orders/${crypto.randomUUID()}`)).status).toBe(404);
    const result = await requestApi("/api/customers?search=does-not-exist");
    const list = Contracts.CustomerList.parse(await result.json());
    expect(list.data).toEqual([]);
  });
});

it("uses integer cents and rounds tax once per order", () => {
  expect(calculateTotals([{ unitPriceCents: 105, quantity: 3 }], 825, 350)).toEqual({
    subtotalCents: 315,
    taxCents: 26,
    deliveryFeeCents: 350,
    totalCents: 691,
  });
});
