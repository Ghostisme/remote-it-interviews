import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-zod";
import {
  categories,
  customers,
  menuItems,
  orderAction,
  orderEvents,
  orderItems,
  orderStatus,
  orders,
  settings,
} from "./db/schema";

// The Drizzle model is the only source of persisted shapes and enum values.
const { createSelectSchema, createInsertSchema } = createSchemaFactory({ zodInstance: z });
const nameSchema = z.string().trim().min(2).max(80);
const priceCentsSchema = z.number().int().min(1).max(1000000);
const serializedTimestampSchema = z.string().datetime({ offset: true });
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour time)");

/** Persisted category shape shared by menu management and ordering. */
export const Category = createSelectSchema(categories).openapi("Category");
/** Category creation accepts a name; identity and ordering defaults stay server-owned. */
export const CreateCategory = createInsertSchema(categories, { name: nameSchema })
  .pick({ name: true })
  .strict()
  .openapi("CreateCategory");
/** Require at least one editable field when renaming or reordering a category. */
export const UpdateCategory = createInsertSchema(categories, {
  name: nameSchema,
  sortOrder: z.number().int().min(0).max(999),
})
  .pick({ name: true, sortOrder: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateCategory");
/** Serialize timestamps as ISO strings while deriving the remaining fields from Drizzle. */
export const MenuItem = createSelectSchema(menuItems, {
  createdAt: serializedTimestampSchema,
  updatedAt: serializedTimestampSchema,
  archivedAt: serializedTimestampSchema.nullable(),
}).openapi("MenuItem");
/** Allow curated image keys and editable dish fields, excluding lifecycle metadata. */
export const CreateMenuItem = createInsertSchema(menuItems, {
  name: nameSchema,
  description: z.string().trim().max(600).optional(),
  priceCents: priceCentsSchema,
  imageKey: z.enum([
    "salad",
    "burger",
    "pasta",
    "pizza",
    "salmon",
    "steak",
    "soup",
    "cake",
    "coffee",
    "lemonade",
    "bowl",
    "bread",
  ]),
})
  .omit({ id: true, archivedAt: true, createdAt: true, updatedAt: true })
  .strict()
  .openapi("CreateMenuItem");
/** Reuse creation validation for a nonempty partial dish update. */
export const UpdateMenuItem = CreateMenuItem.partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateMenuItem");
/** Public guest record used by CRM and order details. */
export const Customer = createSelectSchema(customers, {
  createdAt: serializedTimestampSchema,
  updatedAt: serializedTimestampSchema,
}).openapi("Customer");
/** Allow optional contact details while excluding generated IDs and timestamps. */
export const CreateCustomer = createInsertSchema(customers, {
  name: nameSchema,
  email: z.email().max(180).nullable().optional(),
  phone: z.string().trim().min(5).max(30).nullable().optional(),
  notes: z.string().trim().max(600).optional(),
})
  .omit({ id: true, createdAt: true, updatedAt: true })
  .strict()
  .openapi("CreateCustomer");
/** Validate a nonempty partial guest-profile update. */
export const UpdateCustomer = CreateCustomer.partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateCustomer");
/** Public representation of the single restaurant settings row. */
export const Settings = createSelectSchema(settings, {
  updatedAt: serializedTimestampSchema,
}).openapi("Settings");
/** Constrain fees in cents, tax in basis points and hours in 24-hour local time. */
export const UpdateSettings = createInsertSchema(settings, {
  restaurantName: nameSchema,
  currency: z.literal("USD"),
  prepTimeMinutes: z.number().int().min(5).max(120),
  deliveryFeeCents: z.number().int().min(0).max(100000),
  minimumOrderCents: z.number().int().min(0).max(1000000),
  taxRateBps: z.number().int().min(0).max(3000),
  openingTime: timeOfDaySchema,
  closingTime: timeOfDaySchema,
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone"),
})
  .omit({ id: true, updatedAt: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateSettings");

/** Reuse database enum values so API status strings cannot drift from persistence. */
export const OrderStatus = z.enum(orderStatus.enumValues).openapi("OrderStatus");
/** Expose command names derived from the database audit-action enum. */
export const OrderAction = z.enum(orderAction.enumValues).openapi("OrderAction");
/** Public order snapshot; private retry keys and payload hashes never leave the backend. */
export const Order = createSelectSchema(orders, {
  createdAt: serializedTimestampSchema,
  updatedAt: serializedTimestampSchema,
})
  .omit({ requestHash: true, idempotencyKey: true })
  .openapi("Order");
/** Historical dish name, unit price and quantity captured when the order was placed. */
export const OrderItem = createSelectSchema(orderItems).openapi("OrderItem");
/** A timestamped status/action entry for the order detail timeline. */
export const OrderEvent = createSelectSchema(orderEvents, {
  createdAt: serializedTimestampSchema,
}).openapi("OrderEvent");
/** Accept identity and quantity only; the server looks up the authoritative price. */
export const OrderLineInput = createInsertSchema(orderItems, {
  quantity: z.number().int().min(1).max(99),
})
  .pick({ menuItemId: true, quantity: true })
  .strict()
  .openapi("OrderLineInput");
/** Require unique dish IDs and an address for delivery before starting a transaction. */
export const CreateOrder = createInsertSchema(orders, {
  notes: z.string().trim().max(600).optional(),
  deliveryAddress: z.string().trim().max(300).nullable().optional(),
})
  .pick({
    customerId: true,
    fulfillment: true,
    notes: true,
    deliveryAddress: true,
    idempotencyKey: true,
  })
  .extend({ items: z.array(OrderLineInput).min(1).max(30) })
  .strict()
  .superRefine((value, context) => {
    if (value.fulfillment === "delivery" && !value.deliveryAddress?.trim())
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "A delivery address is required",
      });
    if (new Set(value.items.map((item) => item.menuItemId)).size !== value.items.length)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Each menu item must appear only once",
      });
  })
  .openapi("CreateOrder");
/** Require the operator-observed version to detect concurrent status changes. */
export const ApplyOrderAction = z
  .object({
    action: OrderAction,
    version: createSelectSchema(orders).shape.version,
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .openapi("ApplyOrderAction");
/** Compact list row enriched with the guest name and total item quantity. */
export const OrderSummary = Order.extend({
  customerName: Customer.shape.name,
  itemCount: z.number().int(),
}).openapi("OrderSummary");
/** One order aggregate with its guest, snapshots, timeline and legal next commands. */
export const OrderDetail = z
  .object({
    order: Order,
    customer: Customer,
    items: z.array(OrderItem),
    events: z.array(OrderEvent),
    allowedActions: z.array(OrderAction),
  })
  .openapi("OrderDetail");
/** Guest profile plus completed spend, noncancelled order count and last activity. */
export const CustomerSummary = Customer.extend({
  orderCount: z.number().int(),
  spendCents: z.number().int(),
  lastOrderAt: serializedTimestampSchema.nullable(),
}).openapi("CustomerSummary");
/** CRM detail payload with recent order links. */
export const CustomerDetail = z
  .object({ customer: CustomerSummary, orders: z.array(OrderSummary) })
  .openapi("CustomerDetail");
/** Common server-calculated pagination metadata for directory and order queries. */
export const Pagination = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("Pagination");
/** Paginated order summaries returned by the orders API. */
export const OrderList = z
  .object({ data: z.array(OrderSummary), pagination: Pagination })
  .openapi("OrderList");
/** Paginated guest summaries returned by the CRM API. */
export const CustomerList = z
  .object({ data: z.array(CustomerSummary), pagination: Pagination })
  .openapi("CustomerList");
/** Menu-management payload containing dishes and their display categories. */
export const MenuList = z
  .object({ items: z.array(MenuItem), categories: z.array(Category) })
  .openapi("MenuList");
/** Home reporting payload with period comparisons, daily buckets and popular dishes. */
export const Summary = z
  .object({
    periodDays: z.number().int(),
    revenueCents: z.number().int(),
    revenueChange: z.number().nullable(),
    orderCount: z.number().int(),
    orderChange: z.number().nullable(),
    activeOrders: z.number().int(),
    averageOrderCents: z.number().int(),
    customersCount: z.number().int(),
    daily: z.array(
      z.object({ date: z.string(), revenueCents: z.number().int(), orderCount: z.number().int() }),
    ),
    popularItems: z.array(
      z.object({
        menuItemId: MenuItem.shape.id,
        name: MenuItem.shape.name,
        imageKey: MenuItem.shape.imageKey,
        quantity: z.number().int(),
        revenueCents: z.number().int(),
      }),
    ),
    recentOrders: z.array(OrderSummary),
  })
  .openapi("Summary");
/** Stable error envelope with optional field messages and a traceable request ID. */
export const ApiError = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      fields: z.record(z.string(), z.string()).optional(),
    }),
    requestId: z.string(),
  })
  .openapi("ApiError");
/** Validate record identity before a route reads or modifies the database. */
export const IdParam = z.object({ id: z.uuid() });
const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).optional(),
};
/** Coerce URL pagination values and validate supported order filters. */
export const OrderQuery = z.object({
  ...paginationFields,
  status: OrderStatus.optional(),
  fulfillment: Order.shape.fulfillment.optional(),
  period: z.enum(["today", "week", "all"]).default("all"),
});
/** Reuse pagination and text-search validation for the guest directory. */
export const CustomerQuery = z.object(paginationFields);
/** Bound the reporting period so daily chart queries remain small. */
export const SummaryQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) });

export type CreateOrderInput = z.infer<typeof CreateOrder>;
export type ActionInput = z.infer<typeof ApplyOrderAction>;
