import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { ActionInput, CreateOrderInput } from "../contracts";
import type { Database, Transaction } from "../db/client";
import { customers, menuItems, orderEvents, orderItems, orders, settings } from "../db/schema";
import { DomainError } from "./errors";

type OrderStatus = typeof orders.$inferSelect.status;
type OrderAction = ActionInput["action"];
const BASIS_POINTS_SCALE = 10_000;

// Terminal states deliberately have no actions; the API also exposes this map to the UI.
const orderStatusTransitions: Record<OrderStatus, Partial<Record<OrderAction, OrderStatus>>> = {
  pending: { accept: "accepted", cancel: "cancelled" },
  accepted: { prepare: "preparing", cancel: "cancelled" },
  preparing: { mark_ready: "ready", cancel: "cancelled" },
  ready: { complete: "completed", cancel: "cancelled" },
  completed: {},
  cancelled: {},
};

/** Return only commands that are valid for the order's current persisted status. */
export function allowedActions(status: OrderStatus): OrderAction[] {
  return Object.keys(orderStatusTransitions[status]) as OrderAction[];
}

/** Calculate authoritative integer-cent totals, rounding tax once on the full subtotal. */
export function calculateTotals(
  lines: { unitPriceCents: number; quantity: number }[],
  taxRateBps: number,
  deliveryFeeCents: number,
) {
  const subtotalCents = lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0,
  );
  const taxCents = Math.round((subtotalCents * taxRateBps) / BASIS_POINTS_SCALE);
  return {
    subtotalCents,
    taxCents,
    deliveryFeeCents,
    totalCents: subtotalCents + taxCents + deliveryFeeCents,
  };
}

/** Keep retry metadata private when an order crosses the API boundary. */
function toPublicOrder(order: typeof orders.$inferSelect) {
  const { requestHash: _requestHash, idempotencyKey: _idempotencyKey, ...result } = order;
  return result;
}

/** Load the order snapshot, guest, chronological history and currently permitted actions. */
export async function getOrderDetail(db: Database | Transaction, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new DomainError(404, "ORDER_NOT_FOUND", "This order could not be found.");
  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
  if (!customer)
    throw new DomainError(404, "CUSTOMER_NOT_FOUND", "The customer could not be found.");
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.name));
  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.createdAt));
  return {
    order: toPublicOrder(order),
    customer,
    items,
    events,
    allowedActions: allowedActions(order.status),
  };
}

/**
 * Place an order atomically using current menu prices and restaurant service settings.
 * Identical retries return the original order; reusing a key for another payload conflicts.
 */
export async function createOrder(db: Database, input: CreateOrderInput) {
  // Canonical defaults and item ordering make equivalent retry payloads hash identically.
  const normalizedRequest = {
    ...input,
    notes: input.notes ?? "",
    deliveryAddress: input.deliveryAddress ?? null,
    items: [...input.items].sort((first, second) =>
      first.menuItemId.localeCompare(second.menuItemId),
    ),
  };
  const requestDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(normalizedRequest)),
  );
  const requestHash = Array.from(new Uint8Array(requestDigest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return db.transaction(async (tx) => {
    // Serialize equal keys, including two simultaneous requests before either row exists.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`);
    const [existingOrder] = await tx
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey));
    if (existingOrder) {
      if (existingOrder.requestHash !== requestHash)
        throw new DomainError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This request key was already used for a different order.",
        );
      return getOrderDetail(tx, existingOrder.id);
    }
    // Shared locks keep settings and dish prices stable until this order commits.
    const [restaurantSettings] = await tx
      .select()
      .from(settings)
      .where(eq(settings.id, 1))
      .for("share");
    if (!restaurantSettings)
      throw new DomainError(503, "NOT_INITIALIZED", "Seed the restaurant settings first.");
    if (!restaurantSettings.acceptingOrders)
      throw new DomainError(
        409,
        "ORDERS_PAUSED",
        "The restaurant is currently not accepting new orders.",
      );
    const enabledServices = {
      delivery: restaurantSettings.deliveryEnabled,
      pickup: restaurantSettings.pickupEnabled,
      dine_in: restaurantSettings.dineInEnabled,
    };
    if (!enabledServices[input.fulfillment])
      throw new DomainError(
        409,
        "SERVICE_UNAVAILABLE",
        "This service is currently unavailable. Choose another order type.",
      );
    const [customer] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, input.customerId));
    if (!customer)
      throw new DomainError(
        404,
        "CUSTOMER_NOT_FOUND",
        "Select an existing customer before ordering.",
      );
    const requestedMenuItems = await tx
      .select()
      .from(menuItems)
      .where(
        inArray(
          menuItems.id,
          input.items.map((item) => item.menuItemId),
        ),
      )
      .for("share");
    if (requestedMenuItems.length !== input.items.length)
      throw new DomainError(400, "INVALID_MENU_ITEM", "One or more menu items no longer exist.");
    const menuItemsById = new Map(requestedMenuItems.map((item) => [item.id, item]));
    // Store names and prices as snapshots so later menu edits cannot rewrite order history.
    const orderLines = input.items.map((line) => {
      const item = menuItemsById.get(line.menuItemId);
      if (item?.archivedAt)
        throw new DomainError(
          409,
          "ITEM_ARCHIVED",
          `${item.name} is no longer on the menu. Please remove it from the order.`,
        );
      if (!item?.available)
        throw new DomainError(
          409,
          "ITEM_UNAVAILABLE",
          `${item?.name ?? "This item"} is currently sold out. Please remove it from the order.`,
        );
      return {
        menuItemId: item.id,
        name: item.name,
        unitPriceCents: item.priceCents,
        quantity: line.quantity,
      };
    });
    const orderTotals = calculateTotals(
      orderLines,
      restaurantSettings.taxRateBps,
      input.fulfillment === "delivery" ? restaurantSettings.deliveryFeeCents : 0,
    );
    if (orderTotals.subtotalCents < restaurantSettings.minimumOrderCents)
      throw new DomainError(
        400,
        "MINIMUM_ORDER",
        `The subtotal must be at least $${(restaurantSettings.minimumOrderCents / 100).toFixed(2)}.`,
      );
    const [order] = await tx
      .insert(orders)
      .values({
        ...orderTotals,
        customerId: input.customerId,
        fulfillment: input.fulfillment,
        notes: input.notes ?? "",
        deliveryAddress: input.deliveryAddress,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        status: restaurantSettings.autoAccept ? "accepted" : "pending",
      })
      .returning();
    if (!order) throw new Error("Order insert returned no row");
    await tx.insert(orderItems).values(orderLines.map((line) => ({ ...line, orderId: order.id })));
    await tx.insert(orderEvents).values({
      orderId: order.id,
      status: order.status,
      note: restaurantSettings.autoAccept ? "Order automatically accepted" : "Order placed",
    });
    return getOrderDetail(tx, order.id);
  });
}

/** Apply one legal transition and its timeline event, rejecting stale operator versions. */
export async function applyOrderAction(db: Database, orderId: string, input: ActionInput) {
  return db.transaction(async (tx) => {
    // The row lock serializes competing actions before the expected version is checked.
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new DomainError(404, "ORDER_NOT_FOUND", "This order could not be found.");
    if (order.version !== input.version)
      throw new DomainError(
        409,
        "ORDER_CHANGED",
        "This order was updated elsewhere. Refresh and try again.",
      );
    const nextStatus = orderStatusTransitions[order.status][input.action];
    if (!nextStatus)
      throw new DomainError(
        409,
        "INVALID_TRANSITION",
        `You cannot ${input.action.replaceAll("_", " ")} an order that is ${order.status}.`,
      );
    await tx
      .update(orders)
      .set({ status: nextStatus, version: order.version + 1, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.version, input.version)));
    await tx
      .insert(orderEvents)
      .values({ orderId, status: nextStatus, action: input.action, note: input.note ?? "" });
    return getOrderDetail(tx, orderId);
  });
}
