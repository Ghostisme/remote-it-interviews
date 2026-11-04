import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, eq, sql } from "drizzle-orm";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import * as C from "./contracts";
import { connectDatabase, type Database } from "./db/client";
import { categories, customers, menuItems, settings } from "./db/schema";
import { DomainError } from "./domain/errors";
import { deleteCategory, deleteMenuItem, setMenuItemArchived, updateCategory } from "./domain/menu";
import { applyOrderAction, createOrder, orderDetail } from "./domain/orders";
import {
  customerDetail,
  dashboardSummary,
  getSettings,
  listCustomers,
  listOrders,
} from "./domain/queries";
import { serialize } from "./serialize";

type Env = {
  Bindings: { DATABASE_URL: string; ALLOWED_ORIGINS?: string };
  Variables: { db: Database; requestId: string };
};
const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const errors = {
  400: json(C.ApiError, "Invalid input"),
  404: json(C.ApiError, "Not found"),
  409: json(C.ApiError, "Business rule conflict"),
  503: json(C.ApiError, "Service unavailable"),
};

export function createApp(database?: Database) {
  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Please check the highlighted fields.",
              fields: Object.fromEntries(
                result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
              ),
            },
            requestId: c.get("requestId"),
          },
          400,
        );
    },
  });
  app.use("*", async (c, next) => {
    const id = crypto.randomUUID();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  });
  app.use(
    "*",
    cors({
      origin: (origin, c) =>
        (c.env?.ALLOWED_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081")
          .split(",")
          .includes(origin)
          ? origin
          : undefined,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      exposeHeaders: ["X-Request-Id"],
    }),
  );
  app.use("/api/*", async (c, next) => {
    if (database) {
      c.set("db", database);
      return next();
    }
    if (!c.env?.DATABASE_URL)
      throw new DomainError(
        503,
        "DATABASE_UNCONFIGURED",
        "Configure DATABASE_URL before starting the API.",
      );
    const { db, pool } = connectDatabase(c.env.DATABASE_URL);
    c.set("db", db);
    try {
      await next();
    } finally {
      c.executionCtx.waitUntil(pool.end());
    }
  });
  app.onError((error, c) => {
    if (error instanceof DomainError)
      return c.json(
        { error: { code: error.code, message: error.message }, requestId: c.get("requestId") },
        error.status,
      );
    const code =
      (error as { code?: string }).code ?? (error.cause as { code?: string } | undefined)?.code;
    if (code === "23505")
      return c.json(
        {
          error: { code: "ALREADY_EXISTS", message: "That email or name is already in use." },
          requestId: c.get("requestId"),
        },
        409,
      );
    if (code === "23503")
      return c.json(
        {
          error: {
            code: "INVALID_REFERENCE",
            message: "The selected record no longer exists. Refresh and try again.",
          },
          requestId: c.get("requestId"),
        },
        400,
      );
    if (error instanceof SyntaxError || (error instanceof HTTPException && error.status === 400))
      return c.json(
        {
          error: { code: "INVALID_JSON", message: "The request must contain valid JSON." },
          requestId: c.get("requestId"),
        },
        400,
      );
    console.error(JSON.stringify({ requestId: c.get("requestId"), message: error.message, code }));
    return c.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The service is temporarily unavailable. Please try again.",
        },
        requestId: c.get("requestId"),
      },
      503,
    );
  });
  app.notFound((c) =>
    c.json(
      {
        error: { code: "NOT_FOUND", message: "This endpoint does not exist." },
        requestId: c.get("requestId"),
      },
      404,
    ),
  );
  app.get("/health", (c) => c.json({ status: "ok", service: "odyssey-api" }));
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/health",
      operationId: "getHealth",
      tags: ["System"],
      responses: {
        200: json(
          z.object({ status: z.literal("ok"), database: z.literal("postgresql") }),
          "Database readiness",
        ),
        ...errors,
      },
    }),
    async (c) => {
      await c.get("db").execute(sql`SELECT 1`);
      return c.json({ status: "ok" as const, database: "postgresql" as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/menu",
      operationId: "getMenu",
      tags: ["Menu"],
      responses: { 200: json(C.MenuList, "Menu and categories"), ...errors },
    }),
    async (c) => {
      const db = c.get("db");
      return c.json(
        serialize({
          items: await db.select().from(menuItems).orderBy(asc(menuItems.name)),
          categories: await db
            .select()
            .from(categories)
            .orderBy(asc(categories.sortOrder), asc(categories.name)),
        }),
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/categories",
      operationId: "createCategory",
      tags: ["Menu"],
      request: { body: body(C.CreateCategory) },
      responses: { 201: json(C.Category, "Category created"), ...errors },
    }),
    async (c) => {
      const [row] = await c.get("db").insert(categories).values(c.req.valid("json")).returning();
      return c.json(row as typeof categories.$inferSelect, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/categories/{id}",
      operationId: "updateCategory",
      tags: ["Menu"],
      request: { params: C.IdParam, body: body(C.UpdateCategory) },
      responses: { 200: json(C.Category, "Category updated"), ...errors },
    }),
    async (c) =>
      c.json(await updateCategory(c.get("db"), c.req.valid("param").id, c.req.valid("json")), 200),
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/categories/{id}",
      operationId: "deleteCategory",
      tags: ["Menu"],
      request: { params: C.IdParam },
      responses: { 204: { description: "Empty category deleted" }, ...errors },
    }),
    async (c) => {
      await deleteCategory(c.get("db"), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/menu",
      operationId: "createMenuItem",
      tags: ["Menu"],
      request: { body: body(C.CreateMenuItem) },
      responses: { 201: json(C.MenuItem, "Menu item created"), ...errors },
    }),
    async (c) => {
      const [row] = await c.get("db").insert(menuItems).values(c.req.valid("json")).returning();
      return c.json(serialize(row as typeof menuItems.$inferSelect), 201);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/menu/{id}",
      operationId: "updateMenuItem",
      tags: ["Menu"],
      request: { params: C.IdParam, body: body(C.UpdateMenuItem) },
      responses: { 200: json(C.MenuItem, "Menu item updated"), ...errors },
    }),
    async (c) => {
      const [row] = await c
        .get("db")
        .update(menuItems)
        .set({ ...c.req.valid("json"), updatedAt: new Date() })
        .where(eq(menuItems.id, c.req.valid("param").id))
        .returning();
      if (!row) throw new DomainError(404, "ITEM_NOT_FOUND", "This menu item could not be found.");
      return c.json(serialize(row), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/menu/{id}/archive",
      operationId: "archiveMenuItem",
      tags: ["Menu"],
      request: { params: C.IdParam },
      responses: { 200: json(C.MenuItem, "Removed from ordering; history kept"), ...errors },
    }),
    async (c) =>
      c.json(serialize(await setMenuItemArchived(c.get("db"), c.req.valid("param").id, true)), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/menu/{id}/restore",
      operationId: "restoreMenuItem",
      tags: ["Menu"],
      request: { params: C.IdParam },
      responses: { 200: json(C.MenuItem, "Returned to the active menu"), ...errors },
    }),
    async (c) =>
      c.json(
        serialize(await setMenuItemArchived(c.get("db"), c.req.valid("param").id, false)),
        200,
      ),
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/menu/{id}",
      operationId: "deleteMenuItem",
      tags: ["Menu"],
      request: { params: C.IdParam },
      responses: {
        204: { description: "Archived dish without order history deleted" },
        ...errors,
      },
    }),
    async (c) => {
      await deleteMenuItem(c.get("db"), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/customers",
      operationId: "getCustomers",
      tags: ["CRM"],
      request: { query: C.CustomerQuery },
      responses: { 200: json(C.CustomerList, "Customer directory"), ...errors },
    }),
    async (c) => c.json(serialize(await listCustomers(c.get("db"), c.req.valid("query"))), 200),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/customers/{id}",
      operationId: "getCustomer",
      tags: ["CRM"],
      request: { params: C.IdParam },
      responses: { 200: json(C.CustomerDetail, "Customer and recent 50 orders"), ...errors },
    }),
    async (c) => c.json(serialize(await customerDetail(c.get("db"), c.req.valid("param").id)), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/customers",
      operationId: "createCustomer",
      tags: ["CRM"],
      request: { body: body(C.CreateCustomer) },
      responses: { 201: json(C.Customer, "Customer created"), ...errors },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const [row] = await c
        .get("db")
        .insert(customers)
        .values({ ...input, email: input.email?.toLowerCase() })
        .returning();
      return c.json(serialize(row as typeof customers.$inferSelect), 201);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/customers/{id}",
      operationId: "updateCustomer",
      tags: ["CRM"],
      request: { params: C.IdParam, body: body(C.UpdateCustomer) },
      responses: { 200: json(C.Customer, "Customer updated"), ...errors },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const [row] = await c
        .get("db")
        .update(customers)
        .set({
          ...input,
          ...(input.email !== undefined ? { email: input.email?.toLowerCase() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, c.req.valid("param").id))
        .returning();
      if (!row)
        throw new DomainError(404, "CUSTOMER_NOT_FOUND", "This customer could not be found.");
      return c.json(serialize(row), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/orders",
      operationId: "getOrders",
      tags: ["Orders"],
      request: { query: C.OrderQuery },
      responses: { 200: json(C.OrderList, "Filtered, paginated orders"), ...errors },
    }),
    async (c) => c.json(serialize(await listOrders(c.get("db"), c.req.valid("query"))), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/orders",
      operationId: "createOrder",
      tags: ["Orders"],
      request: { body: body(C.CreateOrder) },
      responses: {
        201: json(C.OrderDetail, "Order placed; identical retries return the original"),
        ...errors,
      },
    }),
    async (c) => c.json(serialize(await createOrder(c.get("db"), c.req.valid("json"))), 201),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/orders/{id}",
      operationId: "getOrder",
      tags: ["Orders"],
      request: { params: C.IdParam },
      responses: { 200: json(C.OrderDetail, "Details and allowed actions"), ...errors },
    }),
    async (c) => c.json(serialize(await orderDetail(c.get("db"), c.req.valid("param").id)), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/orders/{id}/actions",
      operationId: "applyOrderAction",
      tags: ["Orders"],
      request: { params: C.IdParam, body: body(C.ApplyOrderAction) },
      responses: { 200: json(C.OrderDetail, "Action applied with a version check"), ...errors },
    }),
    async (c) =>
      c.json(
        serialize(
          await applyOrderAction(c.get("db"), c.req.valid("param").id, c.req.valid("json")),
        ),
        200,
      ),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/settings",
      operationId: "getSettings",
      tags: ["Settings"],
      responses: { 200: json(C.Settings, "Ordering configuration"), ...errors },
    }),
    async (c) => c.json(serialize(await getSettings(c.get("db"))), 200),
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/settings",
      operationId: "updateSettings",
      tags: ["Settings"],
      request: { body: body(C.UpdateSettings) },
      responses: { 200: json(C.Settings, "Ordering settings saved"), ...errors },
    }),
    async (c) => {
      const [row] = await c
        .get("db")
        .update(settings)
        .set({ ...c.req.valid("json"), updatedAt: new Date() })
        .where(eq(settings.id, 1))
        .returning();
      if (!row) throw new DomainError(503, "NOT_INITIALIZED", "Seed the restaurant first.");
      return c.json(serialize(row), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/summary",
      operationId: "getSummary",
      tags: ["Home"],
      request: { query: C.SummaryQuery },
      responses: {
        200: json(C.Summary, "UTC reporting; revenue from completed orders only"),
        ...errors,
      },
    }),
    async (c) =>
      c.json(serialize(await dashboardSummary(c.get("db"), c.req.valid("query").days)), 200),
  );
  app.doc("/openapi.json", {
    openapi: "3.0.3",
    info: {
      title: "Odyssey Restaurant API",
      version: "1.0.0",
      description:
        "Drizzle → drizzle-zod → Hono OpenAPI. Money is integer cents; tax is basis points.",
    },
  });
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));
  return app;
}
