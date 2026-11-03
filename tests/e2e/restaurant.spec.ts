import { existsSync } from "node:fs";
import { expect, type Page, type Response, test } from "@playwright/test";
import pg from "pg";
import type {
  Category,
  Customer,
  CustomerDetail,
  MenuItem,
  OrderDetail,
  Settings,
  Summary,
  UpdateSettings,
} from "../../packages/api-client/src/generated/model";

const api = "http://localhost:8787/api";
if (existsSync(".env")) process.loadEnvFile(".env");
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://odyssey:odyssey_local@127.0.0.1:55432/odyssey";
// This suite edits the local review workspace and removes only records it created.
if (new URL(databaseUrl).pathname !== "/odyssey")
  throw new Error("Browser tests require the dedicated odyssey demo database.");

async function responseFrom(
  page: Page,
  path: string,
  method: string,
  action: () => Promise<unknown>,
): Promise<Response> {
  const response = page.waitForResponse(
    (r) => r.url() === `${api}${path}` && r.request().method() === method,
  );
  await action();
  const result = await response;
  expect(result.ok(), await result.text()).toBeTruthy();
  return result;
}

async function setSwitch(page: Page, name: string, value: boolean) {
  const control = page.getByRole("switch", { name, exact: true });
  await expect(control).toBeVisible();
  if ((await control.getAttribute("aria-checked")) !== String(value)) await control.click();
}

test("menu → customer → settings → delivery → kitchen → CRM → revenue", async ({
  page,
  request,
}) => {
  const original: Settings = await (await request.get(`${api}/settings`)).json();
  const before: Summary = await (await request.get(`${api}/summary?days=7`)).json();
  const suffix = Date.now();
  const dishName = `Seasonal flatbread ${suffix}`;
  const guestName = `Jamie Review ${suffix}`;
  let categoryId: string | undefined;
  let menuItemId: string | undefined;
  let customerId: string | undefined;
  let orderId: string | undefined;
  let orderNumber = "";
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  try {
    await test.step("Create a category and dish; edit its price and test availability", async () => {
      await page.goto("/menu");
      await page.getByRole("button", { name: "Add category", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Category name", exact: true })
        .fill(`Seasonal ${suffix}`);
      const category: Category = await (
        await responseFrom(page, "/categories", "POST", () =>
          page.getByRole("button", { name: "Create category", exact: true }).click(),
        )
      ).json();
      categoryId = category.id;
      await expect(
        page.getByRole("dialog", { name: "Make room for more", exact: true }),
      ).toBeHidden();
      await page.getByRole("button", { name: "Add menu item", exact: true }).click();
      await page.getByRole("textbox", { name: "Dish name", exact: true }).fill(dishName);
      await page
        .getByRole("textbox", { name: "Description", exact: true })
        .fill("Roasted vegetables, basil and house-made dough.");
      await page.getByRole("textbox", { name: "Price (USD)", exact: true }).fill("12.35");
      await page.getByRole("button", { name: /^Category:/ }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.getByRole("button", { name: "Use Pizza cover", exact: true }).click();
      const item: MenuItem = await (
        await responseFrom(page, "/menu", "POST", () =>
          page
            .getByRole("dialog", { name: "Something new on the menu", exact: true })
            .getByRole("button", { name: "Add menu item", exact: true })
            .click(),
        )
      ).json();
      menuItemId = item.id;
      expect(item.priceCents).toBe(1235);
      // The response arrives before query invalidation finishes and the modal closes.
      // Wait for the actual UI state before typing into the page behind its focus trap.
      await expect(
        page.getByRole("dialog", { name: "Something new on the menu", exact: true }),
      ).toBeHidden();
      const menuSearch = page.getByRole("textbox", { name: "Search your menu...", exact: true });
      await menuSearch.fill(dishName);
      await expect(menuSearch).toHaveValue(dishName);
      await page.getByRole("button", { name: `Edit ${dishName}`, exact: true }).click();
      await page.getByRole("textbox", { name: "Price (USD)", exact: true }).fill("12.75");
      const edited: MenuItem = await (
        await responseFrom(page, `/menu/${item.id}`, "PATCH", () =>
          page.getByRole("button", { name: "Save menu item", exact: true }).click(),
        )
      ).json();
      expect(edited.priceCents).toBe(1275);
      await expect(
        page.getByRole("dialog", { name: "A little menu refinement", exact: true }),
      ).toBeHidden();
      await expect(menuSearch).toHaveValue(dishName);
      await expect(page.getByText("$12.75", { exact: true })).toBeVisible();
      await responseFrom(page, `/menu/${item.id}`, "PATCH", () =>
        page.getByRole("switch", { name: "Available", exact: true }).click(),
      );
      await page.getByRole("button", { name: "New order", exact: true }).click();
      await page.getByRole("textbox", { name: "Find a dish", exact: true }).fill(dishName);
      await expect(
        page.getByRole("button", { name: `Add ${dishName}`, exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("link", { name: "Menu", exact: true }).click();
      await page.getByRole("textbox", { name: "Search your menu...", exact: true }).fill(dishName);
      await responseFrom(page, `/menu/${item.id}`, "PATCH", () =>
        page.getByRole("switch", { name: "Available", exact: true }).click(),
      );
      await expect(page.getByRole("switch", { name: "Available", exact: true })).toBeChecked();
    });

    await test.step("Create and edit a customer; verify the empty order history", async () => {
      await page.getByRole("link", { name: "Customers", exact: true }).click();
      await page.getByRole("button", { name: "Add customer", exact: true }).click();
      await page.getByRole("textbox", { name: "Full name", exact: true }).fill(guestName);
      await page
        .getByRole("textbox", { name: "Email address", exact: true })
        .fill(`review-${suffix}@example.com`);
      await page.getByRole("textbox", { name: "Phone number", exact: true }).fill("+1 555 0199");
      const customer: Customer = await (
        await responseFrom(page, "/customers", "POST", () =>
          page
            .getByRole("dialog", { name: "A new face at the table", exact: true })
            .getByRole("button", { name: "Add customer", exact: true })
            .click(),
        )
      ).json();
      customerId = customer.id;
      await expect(
        page.getByText("Their first visit is still to come", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Edit customer", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Guest notes", exact: true })
        .fill("Prefers a quiet table. No peanuts.");
      await responseFrom(page, `/customers/${customer.id}`, "PATCH", () =>
        page.getByRole("button", { name: "Save customer", exact: true }).click(),
      );
      await expect(
        page.getByText("Prefers a quiet table. No peanuts.", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
    });

    await test.step("Save pricing settings and confirm pausing blocks checkout", async () => {
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await setSwitch(page, "Auto-accept orders", false);
      await setSwitch(page, "Delivery", true);
      await setSwitch(page, "Accepting orders", false);
      await page.getByRole("textbox", { name: "Delivery fee (USD)", exact: true }).fill("4.50");
      await page
        .getByRole("textbox", { name: "Minimum order subtotal (USD)", exact: true })
        .fill("0.00");
      await page.getByRole("textbox", { name: "Tax rate (%)", exact: true }).fill("8.25");
      const saved: Settings = await (
        await responseFrom(page, "/settings", "PATCH", () =>
          page.getByRole("button", { name: "Save changes", exact: true }).first().click(),
        )
      ).json();
      expect(saved.deliveryFeeCents).toBe(450);
      expect(saved.taxRateBps).toBe(825);
      expect(saved.acceptingOrders).toBe(false);
      await expect(
        page.getByRole("switch", { name: "Accepting orders", exact: true }),
      ).not.toBeChecked();
      if ((page.viewportSize()?.width ?? 1440) > 600)
        await expect(page.getByText("Orders paused", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "New order", exact: true }).click();
      await expect(
        page.getByText("New orders are paused. Enable accepting orders in Settings to continue."),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Place order", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await setSwitch(page, "Accepting orders", true);
      await responseFrom(page, "/settings", "PATCH", () =>
        page.getByRole("button", { name: "Save changes", exact: true }).first().click(),
      );
    });

    await test.step("Create a delivery order with integer-cent pricing", async () => {
      await page.getByRole("button", { name: "New order", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Find a customer by name or email", exact: true })
        .fill(guestName);
      await expect
        .poll(async () => {
          const response = await request.get(
            `${api}/customers?search=${encodeURIComponent(guestName)}`,
          );
          return (await response.json()).data.length;
        })
        .toBe(1);
      await page.getByRole("button", { name: "Customer: Choose a customer", exact: true }).click();
      await page.getByRole("button", { name: guestName, exact: true }).click();
      await page.getByRole("textbox", { name: "Find a dish", exact: true }).fill(dishName);
      await page.getByRole("button", { name: `Add ${dishName}`, exact: true }).click();
      await page.getByRole("button", { name: `Add one ${dishName}`, exact: true }).click();
      await page.getByRole("button", { name: /^Service:/ }).click();
      await page.getByRole("button", { name: "Delivery", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Delivery address", exact: true })
        .fill("28 Market Street, Apartment 4, New York");
      await page
        .getByRole("textbox", { name: "Order notes", exact: true })
        .fill("Please ring the doorbell. No peanuts.");
      const detail: OrderDetail = await (
        await responseFrom(page, "/orders", "POST", () =>
          page.getByRole("button", { name: "Place order · $32.10", exact: true }).click(),
        )
      ).json();
      orderId = detail.order.id;
      orderNumber = `#OE-${String(detail.order.number).padStart(4, "0")}`;
      expect(detail.order).toMatchObject({
        customerId,
        status: "pending",
        fulfillment: "delivery",
        subtotalCents: 2550,
        taxCents: 210,
        deliveryFeeCents: 450,
        totalCents: 3210,
      });
      expect(detail.items[0]?.quantity).toBe(2);
      await expect(page.getByText("The order's journey", { exact: true })).toBeVisible();
    });

    await test.step("Progress through the allowed kitchen actions and verify history", async () => {
      for (const label of ["Accept order", "Start preparing", "Mark ready", "Complete order"]) {
        await responseFrom(page, `/orders/${orderId}/actions`, "POST", () =>
          page.getByRole("button", { name: label, exact: true }).click(),
        );
        await expect(page.getByRole("button", { name: label, exact: true })).toBeHidden();
      }
      const detail: OrderDetail = await (await request.get(`${api}/orders/${orderId}`)).json();
      expect(detail.order.status).toBe("completed");
      expect(detail.allowedActions).toEqual([]);
      expect(detail.events).toHaveLength(5);
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search order number or customer", exact: true })
        .fill(guestName);
      await expect(page.getByText(orderNumber, { exact: true })).toBeVisible();
    });

    await test.step("Verify customer spend and open the order from CRM history", async () => {
      await page.getByRole("link", { name: "Customers", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search name, email or phone...", exact: true })
        .fill(guestName);
      await page.getByText(guestName, { exact: true }).click();
      const detail = page.getByRole("dialog", { name: "A familiar face", exact: true });
      await expect(detail.getByText("$32.10", { exact: true }).first()).toBeVisible();
      const customer: CustomerDetail = await (
        await request.get(`${api}/customers/${customerId}`)
      ).json();
      expect(customer.customer.spendCents).toBe(3210);
      expect(customer.customer.orderCount).toBe(1);
      await detail.getByText(orderNumber, { exact: true }).click();
      await expect(page.getByText("The order's journey", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
    });

    await test.step("Confirm Home aggregates and exercise the reporting chart", async () => {
      await page.getByRole("link", { name: "Overview", exact: true }).click();
      const after: Summary = await (await request.get(`${api}/summary?days=7`)).json();
      expect(after.revenueCents).toBe(before.revenueCents + 3210);
      expect(after.orderCount).toBe(before.orderCount + 1);
      await expect(page.getByText("A good day, in the making.", { exact: true })).toBeVisible();
      const revenue = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        after.revenueCents / 100,
      );
      await expect(page.getByText(revenue, { exact: true }).first()).toBeVisible();
      await page.getByRole("button", { name: "Previous chart day", exact: true }).click();
      await page.getByRole("button", { name: /^Reporting period:/ }).click();
      await page.getByRole("button", { name: "Last 30 days", exact: true }).click();
      await expect(
        page.getByText("Your last 30 days, one good service at a time.", { exact: true }),
      ).toBeVisible();
      await page.getByText(orderNumber, { exact: true }).click();
      await expect(page.getByText("The order's journey", { exact: true })).toBeVisible();
      expect(browserErrors).toEqual([]);
    });
  } finally {
    const { id: _id, updatedAt: _updatedAt, ...restore } = original;
    const restored = await request.patch(`${api}/settings`, {
      data: { ...restore, currency: "USD" } satisfies UpdateSettings,
    });
    expect(restored.ok(), "Restore original restaurant settings").toBeTruthy();
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      // Parameterized exact IDs, never truncation or a name-pattern deletion.
      if (orderId) await client.query("DELETE FROM orders WHERE id = $1", [orderId]);
      if (menuItemId) await client.query("DELETE FROM menu_items WHERE id = $1", [menuItemId]);
      if (customerId) await client.query("DELETE FROM customers WHERE id = $1", [customerId]);
      if (categoryId) await client.query("DELETE FROM categories WHERE id = $1", [categoryId]);
    } finally {
      await client.end();
    }
  }
});

test("menu loading, empty search, API error and retry are usable", async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${api}/menu`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/menu");
  await expect(page.getByLabel("Loading", { exact: true }).first()).toBeVisible();
  release();
  await expect(
    page.getByRole("button", { name: "Edit Burrata garden salad", exact: true }),
  ).toBeVisible();
  await page.unroute(`${api}/menu`);
  await page
    .getByRole("textbox", { name: "Search your menu...", exact: true })
    .fill("no-such-dish-zzzz");
  await expect(page.getByText("No dishes found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Burrata garden salad", exact: true }),
  ).toBeVisible();
  await page.route(`${api}/menu`, (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The kitchen connection is temporarily unavailable.",
        },
        requestId: "browser-test",
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByText("The kitchen connection is temporarily unavailable.", { exact: true }),
  ).toBeVisible();
  await page.unroute(`${api}/menu`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Burrata garden salad", exact: true }),
  ).toBeVisible();
});

test("nested selects retain the parent dialog and keyboard focus", async ({ page }) => {
  await page.goto("/menu");
  await page.getByRole("button", { name: "Add menu item", exact: true }).click();
  const parent = page.getByRole("dialog", { name: "Something new on the menu", exact: true });
  const select = page.getByRole("button", { name: /^Category:/ });
  await select.click();
  await expect(page.getByRole("dialog", { name: "Category", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Category", exact: true })).toBeHidden();
  await expect(parent).toBeVisible();
  await expect(select).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(parent).toBeHidden();
  await expect(page.getByRole("button", { name: "Add menu item", exact: true })).toBeFocused();
});

test("all six routes fit a phone; create and edit dialogs remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [route, title] of [
    ["/", "A good day, in the making."],
    ["/orders", "Every order, in good hands."],
    ["/menu", "A menu worth coming back for."],
    ["/crm", "Know the people at your table."],
    ["/settings", "Your restaurant. Your rhythm."],
    ["/ui-library", "Thoughtful by design."],
  ]) {
    await page.goto(route ?? "/");
    await expect(page.getByText(title ?? "", { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    if (route === "/menu") {
      await page.getByRole("button", { name: "Add menu item", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Something new on the menu", exact: true });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(390);
      await expect(
        dialog.getByRole("button", { name: "Add menu item", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    if (route === "/crm") {
      await page.getByRole("button", { name: "Add customer", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
  expect(errors).toEqual([]);
});
