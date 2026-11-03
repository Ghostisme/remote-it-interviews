import { existsSync } from "node:fs";
import { request as apiRequest, expect, test } from "@playwright/test";
import pg from "pg";
import type {
  Category,
  Customer,
  MenuItem,
  OrderDetail,
  Settings,
} from "../../packages/api-client/src/generated/model";

const api = "http://localhost:8787/api";
if (existsSync(".env")) process.loadEnvFile(".env");
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://odyssey:odyssey_local@127.0.0.1:55432/odyssey";
if (new URL(databaseUrl).pathname !== "/odyssey")
  throw new Error("Browser tests require the dedicated odyssey demo database.");

test("rename categories and archive, restore and delete dishes without losing order history", async ({
  page,
}) => {
  const request = await apiRequest.newContext();
  const suffix = Date.now();
  const original: Settings = await (await request.get(`${api}/settings`)).json();
  let category: Category | undefined;
  let customer: Customer | undefined;
  let ordered: OrderDetail | undefined;
  const items: MenuItem[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const categoryResponse = await request.post(`${api}/categories`, {
      data: { name: `Seasonal archive ${suffix}` },
    });
    expect(categoryResponse.ok()).toBe(true);
    category = await categoryResponse.json();
    for (const name of [`Archive me ${suffix}`, `History dish ${suffix}`]) {
      const response = await request.post(`${api}/menu`, {
        data: {
          name,
          description: "Seasonal vegetables and a little extra care.",
          categoryId: category?.id,
          priceCents: 1250,
          imageKey: "salad",
          available: true,
          featured: false,
        },
      });
      expect(response.ok()).toBe(true);
      items.push(await response.json());
    }
    const response = await request.post(`${api}/customers`, {
      data: { name: `Archive guest ${suffix}` },
    });
    expect(response.ok()).toBe(true);
    customer = await response.json();
    expect(
      (
        await request.patch(`${api}/settings`, {
          data: { acceptingOrders: true, pickupEnabled: true, minimumOrderCents: 0 },
        })
      ).ok(),
    ).toBe(true);
    const order = await request.post(`${api}/orders`, {
      data: {
        customerId: customer?.id,
        fulfillment: "pickup",
        idempotencyKey: crypto.randomUUID(),
        items: [{ menuItemId: items[1]?.id, quantity: 1 }],
      },
    });
    expect(order.ok()).toBe(true);
    ordered = await order.json();

    await page.goto("/menu");
    await page.getByRole("button", { name: "Manage categories", exact: true }).click();
    await page
      .getByRole("button", { name: `Edit category ${category?.name}`, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Category name", exact: true })
      .fill(`Chef specials ${suffix}`);
    await page.getByRole("textbox", { name: "Display order", exact: true }).fill("1");
    await page.getByRole("button", { name: "Save category", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Refine your category", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: `Delete category Chef specials ${suffix}`, exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    if ((page.viewportSize()?.width ?? 1440) < 650) {
      await page.getByRole("button", { name: /^Menu category:/ }).click();
      await expect(
        page.getByRole("button", { name: `Chef specials ${suffix}`, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog", { name: "Menu category", exact: true })
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    } else {
      await expect(
        page.getByRole("tab", { name: new RegExp(`Chef specials ${suffix}`) }),
      ).toBeVisible();
    }

    for (const item of items) {
      await page.getByRole("textbox", { name: "Search your menu...", exact: true }).fill(item.name);
      await page.getByRole("button", { name: `Edit ${item.name}`, exact: true }).click();
      await page.getByRole("button", { name: "Archive dish", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Archive this dish?", exact: true })
        .getByRole("button", { name: "Archive dish", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Archive this dish?", exact: true }),
      ).toBeHidden();
      await expect(
        page.getByRole("button", { name: `Edit ${item.name}`, exact: true }),
      ).toHaveCount(0);
    }
    await page.getByRole("button", { name: "New order", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Find a dish", exact: true })
      .fill(items[0]?.name ?? "");
    await expect(
      page.getByRole("button", { name: `Add ${items[0]?.name}`, exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("link", { name: "Menu", exact: true }).click();

    await page
      .getByRole("textbox", { name: "Search your menu...", exact: true })
      .fill(items[0]?.name ?? "");
    await page.getByRole("tab", { name: /^Archived/ }).click();
    await page.getByRole("button", { name: `Restore ${items[0]?.name}`, exact: true }).click();
    await page.getByRole("button", { name: "Restore dish", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Back on the menu?", exact: true })).toBeHidden();
    await page.getByRole("tab", { name: /^Active\b/ }).click();
    await page.getByRole("button", { name: `Edit ${items[0]?.name}`, exact: true }).click();
    await page.getByRole("button", { name: "Archive dish", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Archive this dish?", exact: true })
      .getByRole("button", { name: "Archive dish", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Archive this dish?", exact: true }),
    ).toBeHidden();
    await page.getByRole("tab", { name: /^Archived/ }).click();
    await page.getByRole("button", { name: `Delete ${items[0]?.name}`, exact: true }).click();
    await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Delete this dish?", exact: true })).toBeHidden();
    expect((await request.delete(`${api}/menu/${items[0]?.id}`)).status()).toBe(404);

    await page
      .getByRole("textbox", { name: "Search your menu...", exact: true })
      .fill(items[1]?.name ?? "");
    await page.getByRole("button", { name: `Delete ${items[1]?.name}`, exact: true }).click();
    await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
    await expect(
      page.getByText(
        `${items[1]?.name} appears in past orders, so it stays archived to keep order history intact.`,
        { exact: true },
      ),
    ).toBeVisible();
    const detail: OrderDetail = await (
      await request.get(`${api}/orders/${ordered?.order.id}`)
    ).json();
    expect(detail.items[0]?.name).toBe(items[1]?.name);
    expect(detail.order.totalCents).toBe(ordered?.order.totalCents);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    // Move the history-bearing dish; an empty category can now be deleted.
    const menu = await (await request.get(`${api}/menu`)).json();
    const other = (menu.categories as Category[]).find((c) => c.id !== category?.id);
    expect(
      (
        await request.patch(`${api}/menu/${items[1]?.id}`, { data: { categoryId: other?.id } })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Manage categories", exact: true }).click();
    await page
      .getByRole("button", { name: `Delete category Chef specials ${suffix}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Delete category", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Delete this category?", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: `Edit category Chef specials ${suffix}`, exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const { id: _id, updatedAt: _updatedAt, ...restore } = original;
    const restored = await request.patch(`${api}/settings`, { data: restore });
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      if (ordered) await client.query("DELETE FROM orders WHERE id = $1", [ordered.order.id]);
      for (const item of items)
        await client.query("DELETE FROM menu_items WHERE id = $1", [item.id]);
      if (customer) await client.query("DELETE FROM customers WHERE id = $1", [customer.id]);
      if (category) await client.query("DELETE FROM categories WHERE id = $1", [category.id]);
    } finally {
      await client.end();
      await request.dispose();
    }
    expect(restored.ok()).toBe(true);
  }
});
