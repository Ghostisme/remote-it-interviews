import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { ActionInput, CreateOrderInput } from "../contracts";
import type { Database, Transaction } from "../db/client";
import { customers, menuItems, orderEvents, orderItems, orders, settings } from "../db/schema";
import { DomainError } from "./errors";

type Status = typeof orders.$inferSelect.status;
type Action = ActionInput["action"];
const transitions: Record<Status, Partial<Record<Action, Status>>> = {
  pending: { accept: "accepted", cancel: "cancelled" },
  accepted: { prepare: "preparing", cancel: "cancelled" },
  preparing: { mark_ready: "ready", cancel: "cancelled" },
  ready: { complete: "completed", cancel: "cancelled" },
  completed: {},
  cancelled: {},
};

export function allowedActions(status: Status): Action[] {
  return Object.keys(transitions[status]) as Action[];
}

export function calculateTotals(
  lines: { unitPriceCents: number; quantity: number }[],
  taxRateBps: number,
  deliveryFeeCents: number,
) {
  const subtotalCents = lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0,
  );
  const taxCents = Math.round((subtotalCents * taxRateBps) / 10000);
  return {
    subtotalCents,
    taxCents,
    deliveryFeeCents,
    totalCents: subtotalCents + taxCents + deliveryFeeCents,
  };
}

function publicOrder(order: typeof orders.$inferSelect) {
  const { requestHash: _hash, idempotencyKey: _key, ...result } = order;
  return result;
}

export async function orderDetail(db: Database | Transaction, id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new DomainError(404, "ORDER_NOT_FOUND", "This order could not be found.");
  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
  if (!customer)
    throw new DomainError(404, "CUSTOMER_NOT_FOUND", "The customer could not be found.");
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.name));
  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, id))
    .orderBy(asc(orderEvents.createdAt));
  return {
    order: publicOrder(order),
    customer,
    items,
    events,
    allowedActions: allowedActions(order.status),
  };
}

export async function createOrder(db: Database, input: CreateOrderInput) {
  const normalized = {
    ...input,
    notes: input.notes ?? "",
    deliveryAddress: input.deliveryAddress ?? null,
    items: [...input.items].sort((a, b) => a.menuItemId.localeCompare(b.menuItemId)),
  };
  const hashBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(normalized)),
  );
  const requestHash = Array.from(new Uint8Array(hashBytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return db.transaction(async (tx) => {
    // Serialize equal keys, including two simultaneous requests before either row exists.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`);
    const [existing] = await tx
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey));
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new DomainError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This request key was already used for a different order.",
        );
      return orderDetail(tx, existing.id);
    }
    const [config] = await tx.select().from(settings).where(eq(settings.id, 1)).for("share");
    if (!config)
      throw new DomainError(503, "NOT_INITIALIZED", "Seed the restaurant settings first.");
    if (!config.acceptingOrders)
      throw new DomainError(
        409,
        "ORDERS_PAUSED",
        "The restaurant is currently not accepting new orders.",
      );
    const enabled = {
      delivery: config.deliveryEnabled,
      pickup: config.pickupEnabled,
      dine_in: config.dineInEnabled,
    };
    if (!enabled[input.fulfillment])
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
    const items = await tx
      .select()
      .from(menuItems)
      .where(
        inArray(
          menuItems.id,
          input.items.map((item) => item.menuItemId),
        ),
      )
      .for("share");
    if (items.length !== input.items.length)
      throw new DomainError(400, "INVALID_MENU_ITEM", "One or more menu items no longer exist.");
    const byId = new Map(items.map((item) => [item.id, item]));
    const lines = input.items.map((line) => {
      const item = byId.get(line.menuItemId);
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
    const totals = calculateTotals(
      lines,
      config.taxRateBps,
      input.fulfillment === "delivery" ? config.deliveryFeeCents : 0,
    );
    if (totals.subtotalCents < config.minimumOrderCents)
      throw new DomainError(
        400,
        "MINIMUM_ORDER",
        `The subtotal must be at least $${(config.minimumOrderCents / 100).toFixed(2)}.`,
      );
    const [order] = await tx
      .insert(orders)
      .values({
        ...totals,
        customerId: input.customerId,
        fulfillment: input.fulfillment,
        notes: input.notes ?? "",
        deliveryAddress: input.deliveryAddress,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        status: config.autoAccept ? "accepted" : "pending",
      })
      .returning();
    if (!order) throw new Error("Order insert returned no row");
    await tx.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));
    await tx.insert(orderEvents).values({
      orderId: order.id,
      status: order.status,
      note: config.autoAccept ? "Order automatically accepted" : "Order placed",
    });
    return orderDetail(tx, order.id);
  });
}

export async function applyOrderAction(db: Database, id: string, input: ActionInput) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!order) throw new DomainError(404, "ORDER_NOT_FOUND", "This order could not be found.");
    if (order.version !== input.version)
      throw new DomainError(
        409,
        "ORDER_CHANGED",
        "This order was updated elsewhere. Refresh and try again.",
      );
    const next = transitions[order.status][input.action];
    if (!next)
      throw new DomainError(
        409,
        "INVALID_TRANSITION",
        `You cannot ${input.action.replaceAll("_", " ")} an order that is ${order.status}.`,
      );
    await tx
      .update(orders)
      .set({ status: next, version: order.version + 1, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.version, input.version)));
    await tx
      .insert(orderEvents)
      .values({ orderId: id, status: next, action: input.action, note: input.note ?? "" });
    return orderDetail(tx, id);
  });
}
