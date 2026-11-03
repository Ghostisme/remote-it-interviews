import type { CreateOrder, MenuItem, Settings } from "@odyssey/types";

export function changeQuantity(cart: Record<string, number>, id: string, delta: number) {
  const quantity = Math.max(0, Math.min(99, (cart[id] ?? 0) + delta));
  const next = { ...cart, [id]: quantity };
  if (quantity === 0) delete next[id];
  return next;
}
export function previewOrder(
  cart: Record<string, number>,
  menu: MenuItem[],
  config: Settings,
  fulfillment: CreateOrder["fulfillment"],
) {
  const lines = Object.entries(cart).flatMap(([id, quantity]) => {
    const item = menu.find((row) => row.id === id);
    return item && quantity > 0 ? [{ item, quantity }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.item.priceCents * line.quantity, 0);
  const tax = Math.round((subtotal * config.taxRateBps) / 10000);
  const delivery = fulfillment === "delivery" ? config.deliveryFeeCents : 0;
  return {
    lines,
    subtotal,
    tax,
    delivery,
    total: subtotal + tax + delivery,
    unavailable: lines.some((line) => !line.item.available),
    belowMinimum: subtotal < config.minimumOrderCents,
  };
}
export function parseMoney(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 1000000 ? cents : null;
}
