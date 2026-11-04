/** Check loaded layouts and nested dialogs across phone, tablet, and desktop viewport sizes. */
import { expect, type Page, test } from "@playwright/test";
import type { MenuList } from "../../packages/api-client/src/generated/model";

const routes = [
  ["/", "A good day, in the making.", "/summary"],
  ["/orders", "Every order, in good hands.", "/orders"],
  ["/menu", "A menu worth coming back for.", "/menu"],
  ["/crm", "Know the people at your table.", "/customers"],
  ["/settings", "Your restaurant. Your rhythm.", "/settings"],
  ["/ui-library", "Thoughtful by design.", ""],
] as const;

/** Wait for route data, bundled fonts, and decoded images before measuring layout geometry. */
async function openLoadedPage(page: Page, path: string, title: string, endpoint: string) {
  const routeResponse = endpoint
    ? page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());
        return responseUrl.pathname === `/api${endpoint}` && response.ok();
      })
    : Promise.resolve();
  await page.goto(path);
  await routeResponse;
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  if (endpoint) await expect(page.getByLabel("Loading", { exact: true }).first()).toBeHidden();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(Array.from(document.images, (image) => image.decode()));
    await new Promise(requestAnimationFrame);
  });
}

/** Detect off-screen controls while allowing deliberate table and navigation scroll containers. */
async function expectNoClipping(page: Page) {
  // Checking document.scrollWidth alone misses controls clipped inside overflow:hidden cards.
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>("div, button, input, textarea"))
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return false;
        // Navigation strips and data tables deliberately scroll horizontally.
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (
            ["auto", "scroll"].includes(style.overflowX) &&
            parent.scrollWidth > parent.clientWidth + 1
          )
            return false;
        }
        return bounds.right > viewportWidth + 1 || bounds.left < -1;
      })
      .slice(0, 10)
      .map((element) => ({
        label: (element.getAttribute("aria-label") ?? element.textContent ?? "").slice(0, 90),
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }));
  });
  expect(
    overflow,
    `Clipped content at ${JSON.stringify(page.viewportSize())}: ${page.url()}`,
  ).toEqual([]);
}

test("loaded pages fit phone, tablet and desktop widths without clipped controls", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  const failedResources: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/(api|images|assets)\//.test(response.url()))
      failedResources.push(`${response.status()} ${response.url()}`);
  });
  for (const width of [320, 375, 390, 768, 1024, 1366, 1600]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    for (const [path, title, endpoint] of routes) {
      await openLoadedPage(page, path, title, endpoint);
      await expectNoClipping(page);
      if (path === "/orders") {
        await page.getByRole("tab", { name: "Preparing", exact: true }).click();
        await expect(page.getByRole("tab", { name: "Preparing", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expectNoClipping(page);
      }
    }
  }
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.getByRole("button", { name: "Workspace guide", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Workspace guide", exact: true })).toBeInViewport();
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
});

test("long menu content and nested dialogs remain usable on a small phone", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const name = "SeasonalChefSelection".repeat(4).slice(0, 80);
  const categoryName = "SignatureSeasonalCollection".repeat(4).slice(0, 80);
  await page.route("**/api/menu", async (route) => {
    const response = await route.fetch();
    const menu: MenuList = await response.json();
    const item = menu.items.find((dish) => !dish.archivedAt);
    if (!item) throw new Error("Seeded menu is required for responsive review.");
    item.name = name;
    item.description = "Seasonal vegetables, delicate flavors and a little extra care. "
      .repeat(10)
      .slice(0, 600);
    item.priceCents = 1000000;
    item.featured = false;
    const category = menu.categories.find((entry) => entry.id === item.categoryId);
    if (!category) throw new Error("Seeded category is required for responsive review.");
    category.name = categoryName;
    await route.fulfill({ response, json: menu });
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await openLoadedPage(page, "/menu", "A menu worth coming back for.", "/menu");
  await expectNoClipping(page);
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  const editor = page.getByRole("dialog", { name: "A little menu refinement", exact: true });
  await expect(editor).toBeVisible();
  await expectNoClipping(page);
  await page.getByRole("textbox", { name: "Dish name", exact: true }).focus();
  expect(
    await page
      .getByRole("textbox", { name: "Dish name", exact: true })
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.setViewportSize({ width: 320, height: 400 });
  await expect(
    editor.getByRole("button", { name: "Save menu item", exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: /^Category:/ }).click();
  const picker = page.getByRole("dialog", { name: "Category", exact: true });
  await expect(picker.getByRole("button", { name: categoryName, exact: true })).toBeVisible();
  await expectNoClipping(page);
  await picker.getByRole("button", { name: categoryName, exact: true }).click();
  await expect(editor).toBeVisible();
  await expectNoClipping(page);
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "Manage categories", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Menu categories", exact: true })).toBeVisible();
  await expectNoClipping(page);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "New order", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Find a dish", exact: true })).toBeVisible();
  await expectNoClipping(page);
  await expect(page.getByRole("button", { name: "Place order", exact: true })).toBeInViewport();
  expect(errors).toEqual([]);
});
