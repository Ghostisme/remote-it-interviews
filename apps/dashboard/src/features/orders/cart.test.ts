import type { MenuItem, Settings } from "@odyssey/types";
import { describe, expect, it } from "vitest";
import { calculateOrderPreview, changeQuantity, parseDecimalToHundredths } from "./cart";

const menu: MenuItem[] = [
  {
    id: "dish",
    categoryId: "main",
    name: "Pasta",
    description: "",
    priceCents: 1299,
    imageKey: "pasta",
    available: true,
    featured: false,
    archivedAt: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];
const settings: Settings = {
  id: 1,
  restaurantName: "Olive",
  currency: "USD",
  acceptingOrders: true,
  autoAccept: false,
  deliveryEnabled: true,
  pickupEnabled: true,
  dineInEnabled: true,
  prepTimeMinutes: 20,
  deliveryFeeCents: 350,
  minimumOrderCents: 1000,
  taxRateBps: 825,
  openingTime: "09:00",
  closingTime: "22:00",
  timezone: "UTC",
  updatedAt: "2026-01-01",
};
// These cases protect pricing units, rounding, and stale-menu handling used by checkout.
describe("Order draft", () => {
  it("removes zero quantities, caps large quantities and preserves other lines", () => {
    expect(changeQuantity({ dish: 1, coffee: 2 }, "dish", -1)).toEqual({ coffee: 2 });
    expect(changeQuantity({ dish: 99 }, "dish", 1).dish).toBe(99);
    expect(changeQuantity({}, "dish", -1)).toEqual({});
  });
  it("previews rounded tax and applies delivery fees only to delivery", () => {
    expect(calculateOrderPreview({ dish: 2 }, menu, settings, "delivery")).toMatchObject({
      subtotalCents: 2598,
      taxCents: 214,
      deliveryFeeCents: 350,
      totalCents: 3162,
      isBelowMinimum: false,
    });
    expect(calculateOrderPreview({ dish: 2 }, menu, settings, "pickup").totalCents).toBe(2812);
  });
  it("flags unavailable items and minimum spend rather than silently permitting them", () => {
    expect(
      calculateOrderPreview(
        { dish: 1 },
        menu.map((item) => ({ ...item, available: false })),
        settings,
        "pickup",
      ).hasUnavailableItems,
    ).toBe(true);
    expect(calculateOrderPreview({}, menu, settings, "pickup").isBelowMinimum).toBe(true);
  });
  it("accepts exact cent amounts and rejects invalid prices", () => {
    expect(parseDecimalToHundredths("12.99")).toBe(1299);
    expect(parseDecimalToHundredths("0")).toBe(0);
    for (const value of ["12.999", "-1", "abc", "Infinity", "1e3", "10001"])
      expect(parseDecimalToHundredths(value)).toBeNull();
  });
  it("keeps archived dishes visible in an existing basket and blocks checkout", () => {
    const preview = calculateOrderPreview(
      { dish: 2 },
      menu.map((item) => ({ ...item, archivedAt: "2026-11-04T00:00:00Z" })),
      settings,
      "pickup",
    );
    expect(preview.hasUnavailableItems).toBe(true);
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]?.quantity).toBe(2);
  });
});
