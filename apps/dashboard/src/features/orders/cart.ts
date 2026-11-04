import type { CreateOrder, MenuItem, Settings } from "@odyssey/types";

/** Quantities keyed by menu item ID; zero-quantity entries are removed from the draft. */
export type CartQuantities = Record<string, number>;

/** Apply a quantity change without mutating the cart or exceeding the API's per-line limit. */
export function changeQuantity(cart: CartQuantities, menuItemId: string, quantityChange: number) {
  const quantity = Math.max(0, Math.min(99, (cart[menuItemId] ?? 0) + quantityChange));
  const updatedCart = { ...cart, [menuItemId]: quantity };
  if (quantity === 0) delete updatedCart[menuItemId];
  return updatedCart;
}

/** Preview integer-cent totals; the server revalidates availability and prices at checkout. */
export function calculateOrderPreview(
  cart: CartQuantities,
  menuItems: MenuItem[],
  settings: Settings,
  fulfillment: CreateOrder["fulfillment"],
) {
  const lines = Object.entries(cart).flatMap(([menuItemId, quantity]) => {
    const item = menuItems.find((menuItem) => menuItem.id === menuItemId);
    return item && quantity > 0 ? [{ item, quantity }] : [];
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.item.priceCents * line.quantity, 0);
  // Round tax once on the subtotal, matching the server's basis-point calculation.
  const taxCents = Math.round((subtotalCents * settings.taxRateBps) / 10_000);
  const deliveryFeeCents = fulfillment === "delivery" ? settings.deliveryFeeCents : 0;
  return {
    lines,
    subtotalCents,
    taxCents,
    deliveryFeeCents,
    totalCents: subtotalCents + taxCents + deliveryFeeCents,
    // Retain unavailable lines so the operator can see and remove them explicitly.
    hasUnavailableItems: lines.some((line) => !line.item.available || !!line.item.archivedAt),
    isBelowMinimum: subtotalCents < settings.minimumOrderCents,
  };
}
/** Convert a nonnegative decimal to hundredths (dollars to cents, or percent to basis points). */
export function parseDecimalToHundredths(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const hundredths = Math.round(Number(value) * 100);
  return Number.isSafeInteger(hundredths) && hundredths >= 0 && hundredths <= 1_000_000
    ? hundredths
    : null;
}
