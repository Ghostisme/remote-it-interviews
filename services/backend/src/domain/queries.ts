import type { z } from "@hono/zod-openapi";
import { and, count, desc, eq, getTableColumns, gte, ilike, lt, or, sql } from "drizzle-orm";
import type { CustomerQuery, OrderQuery } from "../contracts";
import type { Database } from "../db/client";
import { customers, menuItems, orderItems, orders, settings } from "../db/schema";
import { DomainError } from "./errors";

const MILLISECONDS_PER_DAY = 86_400_000;

// Never include private idempotency metadata in an order-list response.
const {
  requestHash: _requestHash,
  idempotencyKey: _idempotencyKey,
  ...orderColumns
} = getTableColumns(orders);
const orderSelection = {
  ...orderColumns,
  customerName: customers.name,
  itemCount: sql<number>`coalesce((select sum(quantity)::int from order_items where order_id = ${orders.id}), 0)::int`,
};
/** Keep empty result sets on a valid first page for both list screens. */
export function createPagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
/** Apply the same filters to the count and data queries, with a stable newest-first order. */
export async function listOrders(
  db: Database,
  query: z.infer<typeof OrderQuery>,
  customerId?: string,
) {
  const createdSince =
    query.period === "today"
      ? new Date(new Date().setUTCHours(0, 0, 0, 0))
      : query.period === "week"
        ? new Date(Date.now() - 7 * MILLISECONDS_PER_DAY)
        : undefined;
  // Operators can paste the displayed #OE-0001 value as well as the raw sequence number.
  const normalizedOrderNumber = query.search
    ?.match(/^#?(?:OE-)?(\d+)$/i)?.[1]
    ?.replace(/^0+(?=\d)/, "");
  const filters = and(
    query.status ? eq(orders.status, query.status) : undefined,
    query.fulfillment ? eq(orders.fulfillment, query.fulfillment) : undefined,
    customerId ? eq(orders.customerId, customerId) : undefined,
    createdSince ? gte(orders.createdAt, createdSince) : undefined,
    query.search
      ? or(
          ilike(customers.name, `%${query.search}%`),
          normalizedOrderNumber
            ? sql`cast(${orders.number} as text) ilike ${`%${normalizedOrderNumber}%`}`
            : undefined,
        )
      : undefined,
  );
  const [total] = await db
    .select({ value: count() })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(filters);
  const data = await db
    .select(orderSelection)
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(filters)
    .orderBy(desc(orders.createdAt), desc(orders.number))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { data, pagination: createPagination(query.page, query.pageSize, total?.value ?? 0) };
}
// Cancelled orders do not count as visits, and only completed orders contribute to spend.
const customerSelection = {
  ...getTableColumns(customers),
  orderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelled')::int`,
  spendCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'completed'), 0)::int`,
  lastOrderAt: sql<
    string | null
  >`to_char(max(${orders.createdAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
};
/** Search guest names and aggregate their order history without dropping guests with no orders. */
export async function listCustomers(db: Database, query: z.infer<typeof CustomerQuery>) {
  const filters = query.search
    ? or(
        ilike(customers.name, `%${query.search}%`),
        ilike(customers.email, `%${query.search}%`),
        ilike(customers.phone, `%${query.search}%`),
      )
    : undefined;
  const [total] = await db.select({ value: count() }).from(customers).where(filters);
  const data = await db
    .select(customerSelection)
    .from(customers)
    .leftJoin(orders, eq(customers.id, orders.customerId))
    .where(filters)
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt), customers.name)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { data, pagination: createPagination(query.page, query.pageSize, total?.value ?? 0) };
}
/** Return one CRM profile with the latest 50 orders and lifetime spend/count aggregates. */
export async function getCustomerDetail(db: Database, customerId: string) {
  const [customer] = await db
    .select(customerSelection)
    .from(customers)
    .leftJoin(orders, eq(customers.id, orders.customerId))
    .where(eq(customers.id, customerId))
    .groupBy(customers.id);
  if (!customer)
    throw new DomainError(404, "CUSTOMER_NOT_FOUND", "This customer could not be found.");
  const recentOrders = await listOrders(db, { page: 1, pageSize: 50, period: "all" }, customerId);
  return { customer, orders: recentOrders.data };
}
/** Read the single restaurant settings row, reporting an unseeded database explicitly. */
export async function getSettings(db: Database) {
  const [restaurantSettings] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!restaurantSettings)
    throw new DomainError(503, "NOT_INITIALIZED", "Run pnpm db:seed to initialize the restaurant.");
  return restaurantSettings;
}
/** Report a one-decimal percentage change, or null when the previous period had no activity. */
const calculatePercentageChange = (current: number, previous: number) =>
  previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
/** Build UTC day buckets and compare the selected period with the preceding equal-length period. */
export async function getDashboardSummary(db: Database, days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const periodStart = new Date(today.getTime() - (days - 1) * MILLISECONDS_PER_DAY);
  const periodEnd = new Date(today.getTime() + MILLISECONDS_PER_DAY);
  const previousPeriodStart = new Date(periodStart.getTime() - days * MILLISECONDS_PER_DAY);
  const summarySelect = {
    revenueCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'completed'), 0)::int`,
    orderCount: sql<number>`count(*) filter (where ${orders.status} <> 'cancelled')::int`,
    completedCount: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
  };
  const [currentPeriod] = await db
    .select(summarySelect)
    .from(orders)
    .where(and(gte(orders.createdAt, periodStart), lt(orders.createdAt, periodEnd)));
  const [previousPeriod] = await db
    .select(summarySelect)
    .from(orders)
    .where(and(gte(orders.createdAt, previousPeriodStart), lt(orders.createdAt, periodStart)));
  // Active kitchen work and the guest count are all-time operational metrics.
  const [activeOrderCount] = await db
    .select({ value: count() })
    .from(orders)
    .where(sql`${orders.status} in ('pending', 'accepted', 'preparing', 'ready')`);
  const [customerCount] = await db.select({ value: count() }).from(customers);
  const dailyAggregates = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      revenueCents: summarySelect.revenueCents,
      orderCount: summarySelect.orderCount,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, periodStart), lt(orders.createdAt, periodEnd)))
    .groupBy(sql`to_char(${orders.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);
  // Fill inactive days so chart points retain a consistent daily cadence.
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(periodStart.getTime() + index * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    return (
      dailyAggregates.find((row) => row.date === date) ?? { date, revenueCents: 0, orderCount: 0 }
    );
  });
  // Popular-dish revenue includes food lines only, while summary revenue includes tax and fees.
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
      and(
        eq(orders.status, "completed"),
        gte(orders.createdAt, periodStart),
        lt(orders.createdAt, periodEnd),
      ),
    )
    .groupBy(menuItems.id)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(4);
  const recentOrders = await listOrders(db, { page: 1, pageSize: 5, period: "all" });
  return {
    periodDays: days,
    revenueCents: currentPeriod?.revenueCents ?? 0,
    revenueChange: calculatePercentageChange(
      currentPeriod?.revenueCents ?? 0,
      previousPeriod?.revenueCents ?? 0,
    ),
    orderCount: currentPeriod?.orderCount ?? 0,
    orderChange: calculatePercentageChange(
      currentPeriod?.orderCount ?? 0,
      previousPeriod?.orderCount ?? 0,
    ),
    activeOrders: activeOrderCount?.value ?? 0,
    averageOrderCents: currentPeriod?.completedCount
      ? Math.round(currentPeriod.revenueCents / currentPeriod.completedCount)
      : 0,
    customersCount: customerCount?.value ?? 0,
    daily,
    popularItems,
    recentOrders: recentOrders.data,
  };
}
