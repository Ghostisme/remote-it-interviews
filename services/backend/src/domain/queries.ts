import type { z } from "@hono/zod-openapi";
import { and, count, desc, eq, getTableColumns, gte, ilike, lt, or, sql } from "drizzle-orm";
import type { CustomerQuery, OrderQuery } from "../contracts";
import type { Database } from "../db/client";
import { customers, menuItems, orderItems, orders, settings } from "../db/schema";
import { DomainError } from "./errors";

const { requestHash: _hash, idempotencyKey: _key, ...orderColumns } = getTableColumns(orders);
const orderSelection = {
  ...orderColumns,
  customerName: customers.name,
  itemCount: sql<number>`coalesce((select sum(quantity)::int from order_items where order_id = ${orders.id}), 0)::int`,
};
export function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
export async function listOrders(
  db: Database,
  query: z.infer<typeof OrderQuery>,
  customerId?: string,
) {
  const since =
    query.period === "today"
      ? new Date(new Date().setUTCHours(0, 0, 0, 0))
      : query.period === "week"
        ? new Date(Date.now() - 7 * 86400000)
        : undefined;
  const numberSearch = query.search?.match(/^#?(?:OE-)?(\d+)$/i)?.[1]?.replace(/^0+(?=\d)/, "");
  const where = and(
    query.status ? eq(orders.status, query.status) : undefined,
    query.fulfillment ? eq(orders.fulfillment, query.fulfillment) : undefined,
    customerId ? eq(orders.customerId, customerId) : undefined,
    since ? gte(orders.createdAt, since) : undefined,
    query.search
      ? or(
          ilike(customers.name, `%${query.search}%`),
          numberSearch
            ? sql`cast(${orders.number} as text) ilike ${`%${numberSearch}%`}`
            : undefined,
        )
      : undefined,
  );
  const [total] = await db
    .select({ value: count() })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where);
  const data = await db
    .select(orderSelection)
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.number))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { data, pagination: pagination(query.page, query.pageSize, total?.value ?? 0) };
}
const customerSelection = {
  ...getTableColumns(customers),
  orderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelled')::int`,
  spendCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'completed'), 0)::int`,
  lastOrderAt: sql<
    string | null
  >`to_char(max(${orders.createdAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
};
export async function listCustomers(db: Database, query: z.infer<typeof CustomerQuery>) {
  const where = query.search
    ? or(
        ilike(customers.name, `%${query.search}%`),
        ilike(customers.email, `%${query.search}%`),
        ilike(customers.phone, `%${query.search}%`),
      )
    : undefined;
  const [total] = await db.select({ value: count() }).from(customers).where(where);
  const data = await db
    .select(customerSelection)
    .from(customers)
    .leftJoin(orders, eq(customers.id, orders.customerId))
    .where(where)
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt), customers.name)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { data, pagination: pagination(query.page, query.pageSize, total?.value ?? 0) };
}
export async function customerDetail(db: Database, id: string) {
  const [customer] = await db
    .select(customerSelection)
    .from(customers)
    .leftJoin(orders, eq(customers.id, orders.customerId))
    .where(eq(customers.id, id))
    .groupBy(customers.id);
  if (!customer)
    throw new DomainError(404, "CUSTOMER_NOT_FOUND", "This customer could not be found.");
  const recent = await listOrders(db, { page: 1, pageSize: 50, period: "all" }, id);
  return { customer, orders: recent.data };
}
export async function getSettings(db: Database) {
  const [config] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!config)
    throw new DomainError(503, "NOT_INITIALIZED", "Run pnpm db:seed to initialize the restaurant.");
  return config;
}
const percentage = (current: number, previous: number) =>
  previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
export async function dashboardSummary(db: Database, days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (days - 1) * 86400000);
  const end = new Date(today.getTime() + 86400000);
  const previousStart = new Date(start.getTime() - days * 86400000);
  const summarySelect = {
    revenueCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'completed'), 0)::int`,
    orderCount: sql<number>`count(*) filter (where ${orders.status} <> 'cancelled')::int`,
    completedCount: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
  };
  const [current] = await db
    .select(summarySelect)
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)));
  const [previous] = await db
    .select(summarySelect)
    .from(orders)
    .where(and(gte(orders.createdAt, previousStart), lt(orders.createdAt, start)));
  const [active] = await db
    .select({ value: count() })
    .from(orders)
    .where(sql`${orders.status} in ('pending', 'accepted', 'preparing', 'ready')`);
  const [people] = await db.select({ value: count() }).from(customers);
  const grouped = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      revenueCents: summarySelect.revenueCents,
      orderCount: summarySelect.orderCount,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(sql`to_char(${orders.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
    return grouped.find((row) => row.date === date) ?? { date, revenueCents: 0, orderCount: 0 };
  });
  const popularItems = await db
    .select({
      menuItemId: menuItems.id,
      name: menuItems.name,
      imageKey: menuItems.imageKey,
      quantity: sql<number>`sum(${orderItems.quantity})::int`,
      revenueCents: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPriceCents})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(
      and(eq(orders.status, "completed"), gte(orders.createdAt, start), lt(orders.createdAt, end)),
    )
    .groupBy(menuItems.id)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(4);
  const recent = await listOrders(db, { page: 1, pageSize: 5, period: "all" });
  return {
    periodDays: days,
    revenueCents: current?.revenueCents ?? 0,
    revenueChange: percentage(current?.revenueCents ?? 0, previous?.revenueCents ?? 0),
    orderCount: current?.orderCount ?? 0,
    orderChange: percentage(current?.orderCount ?? 0, previous?.orderCount ?? 0),
    activeOrders: active?.value ?? 0,
    averageOrderCents: current?.completedCount
      ? Math.round(current.revenueCents / current.completedCount)
      : 0,
    customersCount: people?.value ?? 0,
    daily,
    popularItems,
    recentOrders: recent.data,
  };
}
