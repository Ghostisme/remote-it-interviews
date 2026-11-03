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
const name = z.string().trim().min(2).max(80);
const cents = z.number().int().min(1).max(1000000);
const date = z.string().datetime({ offset: true });
const times = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour time)");

export const Category = createSelectSchema(categories).openapi("Category");
export const CreateCategory = createInsertSchema(categories, { name })
  .pick({ name: true })
  .strict()
  .openapi("CreateCategory");
export const UpdateCategory = createInsertSchema(categories, {
  name,
  sortOrder: z.number().int().min(0).max(999),
})
  .pick({ name: true, sortOrder: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateCategory");
export const MenuItem = createSelectSchema(menuItems, {
  createdAt: date,
  updatedAt: date,
  archivedAt: date.nullable(),
}).openapi("MenuItem");
export const CreateMenuItem = createInsertSchema(menuItems, {
  name,
  description: z.string().trim().max(600).optional(),
  priceCents: cents,
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
export const UpdateMenuItem = CreateMenuItem.partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateMenuItem");
export const Customer = createSelectSchema(customers, { createdAt: date, updatedAt: date }).openapi(
  "Customer",
);
export const CreateCustomer = createInsertSchema(customers, {
  name,
  email: z.email().max(180).nullable().optional(),
  phone: z.string().trim().min(5).max(30).nullable().optional(),
  notes: z.string().trim().max(600).optional(),
})
  .omit({ id: true, createdAt: true, updatedAt: true })
  .strict()
  .openapi("CreateCustomer");
export const UpdateCustomer = CreateCustomer.partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .openapi("UpdateCustomer");
export const Settings = createSelectSchema(settings, { updatedAt: date }).openapi("Settings");
export const UpdateSettings = createInsertSchema(settings, {
  restaurantName: name,
  currency: z.literal("USD"),
  prepTimeMinutes: z.number().int().min(5).max(120),
  deliveryFeeCents: z.number().int().min(0).max(100000),
  minimumOrderCents: z.number().int().min(0).max(1000000),
  taxRateBps: z.number().int().min(0).max(3000),
  openingTime: times,
  closingTime: times,
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

export const OrderStatus = z.enum(orderStatus.enumValues).openapi("OrderStatus");
export const OrderAction = z.enum(orderAction.enumValues).openapi("OrderAction");
export const Order = createSelectSchema(orders, { createdAt: date, updatedAt: date })
  .omit({ requestHash: true, idempotencyKey: true })
  .openapi("Order");
export const OrderItem = createSelectSchema(orderItems).openapi("OrderItem");
export const OrderEvent = createSelectSchema(orderEvents, { createdAt: date }).openapi(
  "OrderEvent",
);
export const OrderLineInput = createInsertSchema(orderItems, {
  quantity: z.number().int().min(1).max(99),
})
  .pick({ menuItemId: true, quantity: true })
  .strict()
  .openapi("OrderLineInput");
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
  .superRefine((value, ctx) => {
    if (value.fulfillment === "delivery" && !value.deliveryAddress?.trim())
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "A delivery address is required",
      });
    if (new Set(value.items.map((item) => item.menuItemId)).size !== value.items.length)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Each menu item must appear only once",
      });
  })
  .openapi("CreateOrder");
export const ApplyOrderAction = z
  .object({
    action: OrderAction,
    version: createSelectSchema(orders).shape.version,
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .openapi("ApplyOrderAction");
export const OrderSummary = Order.extend({
  customerName: Customer.shape.name,
  itemCount: z.number().int(),
}).openapi("OrderSummary");
export const OrderDetail = z
  .object({
    order: Order,
    customer: Customer,
    items: z.array(OrderItem),
    events: z.array(OrderEvent),
    allowedActions: z.array(OrderAction),
  })
  .openapi("OrderDetail");
export const CustomerSummary = Customer.extend({
  orderCount: z.number().int(),
  spendCents: z.number().int(),
  lastOrderAt: date.nullable(),
}).openapi("CustomerSummary");
export const CustomerDetail = z
  .object({ customer: CustomerSummary, orders: z.array(OrderSummary) })
  .openapi("CustomerDetail");
export const Pagination = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("Pagination");
export const OrderList = z
  .object({ data: z.array(OrderSummary), pagination: Pagination })
  .openapi("OrderList");
export const CustomerList = z
  .object({ data: z.array(CustomerSummary), pagination: Pagination })
  .openapi("CustomerList");
export const MenuList = z
  .object({ items: z.array(MenuItem), categories: z.array(Category) })
  .openapi("MenuList");
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
export const IdParam = z.object({ id: z.uuid() });
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).optional(),
};
export const OrderQuery = z.object({
  ...paging,
  status: OrderStatus.optional(),
  fulfillment: Order.shape.fulfillment.optional(),
  period: z.enum(["today", "week", "all"]).default("all"),
});
export const CustomerQuery = z.object(paging);
export const SummaryQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) });

export type CreateOrderInput = z.infer<typeof CreateOrder>;
export type ActionInput = z.infer<typeof ApplyOrderAction>;
