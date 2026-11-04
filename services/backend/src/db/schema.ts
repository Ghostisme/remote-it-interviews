import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Persist kitchen states once; validation and allowed-action types derive from this enum. */
export const orderStatus = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
/** Supported service types used by settings, order validation and checkout. */
export const fulfillment = pgEnum("fulfillment", ["delivery", "pickup", "dine_in"]);
/** Audit commands recorded whenever an operator moves an order between states. */
export const orderAction = pgEnum("order_action", [
  "accept",
  "prepare",
  "mark_ready",
  "complete",
  "cancel",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Stable category identities with an explicit sort order and unique display names. */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("category_name_idx").on(table.name)],
);

/** Current sellable dish data; archiving preserves references from historical order lines. */
export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    imageKey: text("image_key").notNull().default("salad"),
    available: boolean("available").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("menu_category_idx").on(table.categoryId),
    check("menu_price_positive", sql`${table.priceCents} > 0 AND ${table.priceCents} <= 1000000`),
  ],
);

/** Guest contact details and internal notes; email uniqueness allows absent contact data. */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [uniqueIndex("customer_email_idx").on(table.email)],
);

/** Single-restaurant configuration enforced by the id = 1 database constraint. */
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    restaurantName: text("restaurant_name").notNull().default("Olive & Ember"),
    currency: text("currency").notNull().default("USD"),
    acceptingOrders: boolean("accepting_orders").notNull().default(true),
    autoAccept: boolean("auto_accept").notNull().default(false),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
    pickupEnabled: boolean("pickup_enabled").notNull().default(true),
    dineInEnabled: boolean("dine_in_enabled").notNull().default(true),
    prepTimeMinutes: integer("prep_time_minutes").notNull().default(20),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(350),
    minimumOrderCents: integer("minimum_order_cents").notNull().default(0),
    taxRateBps: integer("tax_rate_bps").notNull().default(800),
    openingTime: text("opening_time").notNull().default("09:00"),
    closingTime: text("closing_time").notNull().default("22:00"),
    timezone: text("timezone").notNull().default("America/New_York"),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    check("settings_singleton", sql`${table.id} = 1`),
    check("settings_prep_time", sql`${table.prepTimeMinutes} BETWEEN 5 AND 120`),
    check("settings_fee", sql`${table.deliveryFeeCents} BETWEEN 0 AND 100000`),
    check("settings_minimum", sql`${table.minimumOrderCents} BETWEEN 0 AND 1000000`),
    check("settings_tax", sql`${table.taxRateBps} BETWEEN 0 AND 3000`),
  ],
);

/** Integer-cent financial snapshot with unique retry identity and optimistic status version. */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    status: orderStatus("status").notNull().default("pending"),
    fulfillment: fulfillment("fulfillment").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    notes: text("notes").notNull().default(""),
    deliveryAddress: text("delivery_address"),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    requestHash: text("request_hash").notNull(),
    version: integer("version").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("order_status_date_idx").on(table.status, table.createdAt),
    index("order_customer_idx").on(table.customerId),
    check(
      "order_totals",
      sql`${table.subtotalCents} >= 0 AND ${table.taxCents} >= 0 AND ${table.deliveryFeeCents} >= 0 AND ${table.totalCents} = ${table.subtotalCents} + ${table.taxCents} + ${table.deliveryFeeCents}`,
    ),
  ],
);

/** Immutable purchase snapshots; dish references prevent deleting historical menu records. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id),
    name: text("name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    index("order_item_order_idx").on(table.orderId),
    check("order_item_quantity", sql`${table.quantity} BETWEEN 1 AND 99`),
    check("order_item_price", sql`${table.unitPriceCents} > 0`),
  ],
);

/** Append-only application timeline for placement and subsequent kitchen actions. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatus("status").notNull(),
    action: orderAction("action"),
    note: text("note").notNull().default(""),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("order_event_order_idx").on(table.orderId)],
);
