import type { MenuItem, Settings } from "@odyssey/types";
import { describe, expect, it } from "vitest";
import { changeQuantity, parseMoney, previewOrder } from "./cart";

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
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];
const config: Settings = {
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
describe("Order draft", () => {
  it("removes zero quantities, caps large quantities and preserves other lines", () => {
    expect(changeQuantity({ dish: 1, coffee: 2 }, "dish", -1)).toEqual({ coffee: 2 });
    expect(changeQuantity({ dish: 99 }, "dish", 1).dish).toBe(99);
    expect(changeQuantity({}, "dish", -1)).toEqual({});
  });
  it("previews rounded tax and applies delivery fees only to delivery", () => {
    expect(previewOrder({ dish: 2 }, menu, config, "delivery")).toMatchObject({
      subtotal: 2598,
      tax: 214,
      delivery: 350,
      total: 3162,
      belowMinimum: false,
    });
    expect(previewOrder({ dish: 2 }, menu, config, "pickup").total).toBe(2812);
  });
  it("flags unavailable items and minimum spend rather than silently permitting them", () => {
    expect(
      previewOrder(
        { dish: 1 },
        menu.map((item) => ({ ...item, available: false })),
        config,
        "pickup",
      ).unavailable,
    ).toBe(true);
    expect(previewOrder({}, menu, config, "pickup").belowMinimum).toBe(true);
  });
  it("accepts exact cent amounts and rejects invalid prices", () => {
    expect(parseMoney("12.99")).toBe(1299);
    expect(parseMoney("0")).toBe(0);
    for (const value of ["12.999", "-1", "abc", "Infinity", "1e3", "10001"])
      expect(parseMoney(value)).toBeNull();
  });
});
