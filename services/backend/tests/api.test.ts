import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import * as C from "../src/contracts";
import { connectDatabase } from "../src/db/client";
import { categories, customers, menuItems, settings } from "../src/db/schema";
import { calculateTotals } from "../src/domain/orders";
import "../scripts/env";

const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://odyssey:odyssey_local@127.0.0.1:55432/odyssey_test";
if (new URL(url).pathname !== "/odyssey_test")
  throw new Error("Tests require the dedicated odyssey_test database.");
const { db, pool } = connectDatabase(url);
const app = createApp(db);
let customerId: string;
let itemId: string;
const request = (path: string, method = "GET", data?: unknown) =>
  app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
const input = () => ({
  customerId,
  fulfillment: "pickup" as const,
  idempotencyKey: crypto.randomUUID(),
  items: [{ menuItemId: itemId, quantity: 2 }],
});
beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
});
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
  itemId = item.id;
});
afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL-backed restaurant API", () => {
  it("returns responses matching the published contract", async () => {
    for (const [path, schema] of [
      ["/api/menu", C.MenuList],
      ["/api/customers", C.CustomerList],
      ["/api/orders", C.OrderList],
      ["/api/settings", C.Settings],
      ["/api/summary", C.Summary],
    ] as const) {
      const result = await request(path);
      expect(result.status, path).toBe(200);
      expect(schema.safeParse(await result.json()).success, path).toBe(true);
    }
  });
  it("calculates prices on the server and snapshots the original menu price", async () => {
    const result = await request("/api/orders", "POST", input());
    expect(result.status).toBe(201);
    const detail = C.OrderDetail.parse(await result.json());
    expect(detail.order).toMatchObject({
      subtotalCents: 2598,
      taxCents: 214,
      totalCents: 2812,
      status: "pending",
    });
    await request(`/api/menu/${itemId}`, "PATCH", { priceCents: 2000 });
    const stored = C.OrderDetail.parse(
      await (await request(`/api/orders/${detail.order.id}`)).json(),
    );
    expect(stored.items[0]?.unitPriceCents).toBe(1299);
    expect(stored.order).not.toHaveProperty("requestHash");
  });
  it("rejects invalid and forged input without creating orders", async () => {
    for (const value of [
      { ...input(), totalCents: 1 },
      { ...input(), items: [] },
      { ...input(), items: [{ menuItemId: itemId, quantity: -1 }] },
      { ...input(), fulfillment: "delivery" },
      {
        ...input(),
        items: [
          { menuItemId: itemId, quantity: 1 },
          { menuItemId: itemId, quantity: 2 },
        ],
      },
    ]) {
      const result = await request("/api/orders", "POST", value);
      expect(result.status).toBe(400);
      C.ApiError.parse(await result.json());
    }
    const list = C.OrderList.parse(await (await request("/api/orders")).json());
    expect(list.pagination.total).toBe(0);
  });
  it("serializes concurrent retries and rejects reusing a key for different content", async () => {
    const payload = input();
    const results = await Promise.all([
      request("/api/orders", "POST", payload),
      request("/api/orders", "POST", payload),
    ]);
    const details = await Promise.all(
      results.map(async (r) => {
        expect(r.status).toBe(201);
        return C.OrderDetail.parse(await r.json());
      }),
    );
    expect(details[0]?.order.id).toBe(details[1]?.order.id);
    const conflict = await request("/api/orders", "POST", { ...payload, notes: "Different" });
    expect(conflict.status).toBe(409);
    const list = C.OrderList.parse(await (await request("/api/orders")).json());
    expect(list.pagination.total).toBe(1);
  });
  it("enforces availability, paused ordering, service flags and minimum spend", async () => {
    await request(`/api/menu/${itemId}`, "PATCH", { available: false });
    expect((await request("/api/orders", "POST", input())).status).toBe(409);
    await request(`/api/menu/${itemId}`, "PATCH", { available: true });
    await request("/api/settings", "PATCH", { acceptingOrders: false });
    expect((await request("/api/orders", "POST", input())).status).toBe(409);
    await request("/api/settings", "PATCH", { acceptingOrders: true, pickupEnabled: false });
    expect((await request("/api/orders", "POST", input())).status).toBe(409);
    await request("/api/settings", "PATCH", { pickupEnabled: true, minimumOrderCents: 5000 });
    expect((await request("/api/orders", "POST", input())).status).toBe(400);
  });
  it("protects state transitions and updates CRM spend and dashboard revenue on completion", async () => {
    let detail = C.OrderDetail.parse(await (await request("/api/orders", "POST", input())).json());
    expect(
      (
        await request(`/api/orders/${detail.order.id}/actions`, "POST", {
          action: "complete",
          version: 0,
        })
      ).status,
    ).toBe(409);
    const concurrent = await Promise.all(
      ["accept", "cancel"].map((action) =>
        request(`/api/orders/${detail.order.id}/actions`, "POST", { action, version: 0 }),
      ),
    );
    expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
    detail = C.OrderDetail.parse(await (await request(`/api/orders/${detail.order.id}`)).json());
    if (detail.order.status === "cancelled")
      detail = C.OrderDetail.parse(await (await request("/api/orders", "POST", input())).json());
    for (const action of detail.order.status === "pending"
      ? ["accept", "prepare", "mark_ready", "complete"]
      : ["prepare", "mark_ready", "complete"]) {
      const result = await request(`/api/orders/${detail.order.id}/actions`, "POST", {
        action,
        version: detail.order.version,
      });
      expect(result.status).toBe(200);
      detail = C.OrderDetail.parse(await result.json());
    }
    expect(detail.allowedActions).toEqual([]);
    expect(detail.events.at(-1)?.status).toBe("completed");
    const customer = C.CustomerDetail.parse(
      await (await request(`/api/customers/${customerId}`)).json(),
    );
    expect(customer.customer.spendCents).toBe(2812);
    const summary = C.Summary.parse(await (await request("/api/summary")).json());
    expect(summary.revenueCents).toBe(2812);
    expect(summary.daily).toHaveLength(7);
  });
  it("validates pagination, unique emails and missing records", async () => {
    expect((await request("/api/orders?pageSize=1000")).status).toBe(400);
    expect(
      (await request("/api/customers", "POST", { name: "Duplicate", email: "test@example.com" }))
        .status,
    ).toBe(409);
    expect((await request(`/api/orders/${crypto.randomUUID()}`)).status).toBe(404);
    const result = await request("/api/customers?search=does-not-exist");
    const list = C.CustomerList.parse(await result.json());
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
