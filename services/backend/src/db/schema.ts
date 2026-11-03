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

export const orderStatus = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
export const fulfillment = pgEnum("fulfillment", ["delivery", "pickup", "dine_in"]);
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

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("category_name_idx").on(t.name)],
);

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
  (t) => [
    index("menu_category_idx").on(t.categoryId),
    check("menu_price_positive", sql`${t.priceCents} > 0 AND ${t.priceCents} <= 1000000`),
  ],
);

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
  (t) => [uniqueIndex("customer_email_idx").on(t.email)],
);

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
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_prep_time", sql`${t.prepTimeMinutes} BETWEEN 5 AND 120`),
    check("settings_fee", sql`${t.deliveryFeeCents} BETWEEN 0 AND 100000`),
    check("settings_minimum", sql`${t.minimumOrderCents} BETWEEN 0 AND 1000000`),
    check("settings_tax", sql`${t.taxRateBps} BETWEEN 0 AND 3000`),
  ],
);

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
  (t) => [
    index("order_status_date_idx").on(t.status, t.createdAt),
    index("order_customer_idx").on(t.customerId),
    check(
      "order_totals",
      sql`${t.subtotalCents} >= 0 AND ${t.taxCents} >= 0 AND ${t.deliveryFeeCents} >= 0 AND ${t.totalCents} = ${t.subtotalCents} + ${t.taxCents} + ${t.deliveryFeeCents}`,
    ),
  ],
);

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
  (t) => [
    index("order_item_order_idx").on(t.orderId),
    check("order_item_quantity", sql`${t.quantity} BETWEEN 1 AND 99`),
    check("order_item_price", sql`${t.unitPriceCents} > 0`),
  ],
);

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
  (t) => [index("order_event_order_idx").on(t.orderId)],
);
