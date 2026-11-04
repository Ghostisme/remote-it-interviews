import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, eq, sql } from "drizzle-orm";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import * as Contracts from "./contracts";
import { connectDatabase, type Database } from "./db/client";
import { categories, customers, menuItems, settings } from "./db/schema";
import { DomainError } from "./domain/errors";
import { deleteCategory, deleteMenuItem, setMenuItemArchived, updateCategory } from "./domain/menu";
import { applyOrderAction, createOrder, getOrderDetail } from "./domain/orders";
import {
  getCustomerDetail,
  getDashboardSummary,
  getSettings,
  listCustomers,
  listOrders,
} from "./domain/queries";
import { serialize } from "./serialize";

type ApiEnvironment = {
  Bindings: { DATABASE_URL: string; ALLOWED_ORIGINS?: string };
  Variables: { db: Database; requestId: string };
};
/** Declare a JSON response once for runtime validation and OpenAPI generation. */
const jsonResponse = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
/** Require a JSON body that uses the same schema as the generated client. */
const jsonRequestBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const errorResponses = {
  400: jsonResponse(Contracts.ApiError, "Invalid input"),
  404: jsonResponse(Contracts.ApiError, "Not found"),
  409: jsonResponse(Contracts.ApiError, "Business rule conflict"),
  503: jsonResponse(Contracts.ApiError, "Service unavailable"),
};

/**
 * Compose typed routes, request tracing and database lifetime management.
 * Tests inject a database; the Worker creates a short-lived pool per request.
 */
export function createApp(database?: Database) {
  const app = new OpenAPIHono<ApiEnvironment>({
    defaultHook: (result, context) => {
      if (!result.success)
        return context.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Please check the highlighted fields.",
              fields: Object.fromEntries(
                result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
              ),
            },
            requestId: context.get("requestId"),
          },
          400,
        );
    },
  });
  // Every success or failure carries the same request ID in headers and error bodies.
  app.use("*", async (context, next) => {
    const requestId = crypto.randomUUID();
    context.set("requestId", requestId);
    context.header("X-Request-Id", requestId);
    await next();
  });
  app.use(
    "*",
    cors({
      origin: (origin, context) =>
        (context.env?.ALLOWED_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081")
          .split(",")
          .includes(origin)
          ? origin
          : undefined,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      exposeHeaders: ["X-Request-Id"],
    }),
  );
  // Register pool cleanup with the Worker even when a handler throws.
  app.use("/api/*", async (context, next) => {
    if (database) {
      context.set("db", database);
      return next();
    }
    if (!context.env?.DATABASE_URL)
      throw new DomainError(
        503,
        "DATABASE_UNCONFIGURED",
        "Configure DATABASE_URL before starting the API.",
      );
    const { db, pool } = connectDatabase(context.env.DATABASE_URL);
    context.set("db", db);
    try {
      await next();
    } finally {
      context.executionCtx.waitUntil(pool.end());
    }
  });
  // Map expected business/constraint failures to public messages without exposing SQL details.
  app.onError((error, context) => {
    if (error instanceof DomainError)
      return context.json(
        {
          error: { code: error.code, message: error.message },
          requestId: context.get("requestId"),
        },
        error.status,
      );
    const code =
      (error as { code?: string }).code ?? (error.cause as { code?: string } | undefined)?.code;
    if (code === "23505")
      return context.json(
        {
          error: { code: "ALREADY_EXISTS", message: "That email or name is already in use." },
          requestId: context.get("requestId"),
        },
        409,
      );
    if (code === "23503")
      return context.json(
        {
          error: {
            code: "INVALID_REFERENCE",
            message: "The selected record no longer exists. Refresh and try again.",
          },
          requestId: context.get("requestId"),
        },
        400,
      );
    // Hono wraps malformed request bodies in HTTPException rather than SyntaxError.
    if (error instanceof SyntaxError || (error instanceof HTTPException && error.status === 400))
      return context.json(
        {
          error: { code: "INVALID_JSON", message: "The request must contain valid JSON." },
          requestId: context.get("requestId"),
        },
        400,
      );
    console.error(
      JSON.stringify({ requestId: context.get("requestId"), message: error.message, code }),
    );
    return context.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The service is temporarily unavailable. Please try again.",
        },
        requestId: context.get("requestId"),
      },
      503,
    );
  });
  app.notFound((context) =>
    context.json(
      {
        error: { code: "NOT_FOUND", message: "This endpoint does not exist." },
        requestId: context.get("requestId"),
      },
      404,
    ),
  );
  app.get("/health", (context) => context.json({ status: "ok", service: "odyssey-api" }));
  // Probe PostgreSQL readiness; /health above only checks process liveness.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/health",
      operationId: "getHealth",
      tags: ["System"],
      responses: {
        200: jsonResponse(
          z.object({ status: z.literal("ok"), database: z.literal("postgresql") }),
          "Database readiness",
        ),
        ...errorResponses,
      },
    }),
    async (context) => {
      await context.get("db").execute(sql`SELECT 1`);
      return context.json({ status: "ok" as const, database: "postgresql" as const }, 200);
    },
  );
  // Include archived records for management; ordering filters them out in its domain rules.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/menu",
      operationId: "getMenu",
      tags: ["Menu"],
      responses: {
        200: jsonResponse(Contracts.MenuList, "Menu and categories"),
        ...errorResponses,
      },
    }),
    async (context) => {
      const db = context.get("db");
      return context.json(
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
  // Let PostgreSQL assign stable category IDs and enforce unique names.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/categories",
      operationId: "createCategory",
      tags: ["Menu"],
      request: { body: jsonRequestBody(Contracts.CreateCategory) },
      responses: { 201: jsonResponse(Contracts.Category, "Category created"), ...errorResponses },
    }),
    async (context) => {
      const [row] = await context
        .get("db")
        .insert(categories)
        .values(context.req.valid("json"))
        .returning();
      return context.json(row as typeof categories.$inferSelect, 201);
    },
  );
  // Keep category identity stable when renaming or changing display order.
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/categories/{id}",
      operationId: "updateCategory",
      tags: ["Menu"],
      request: { params: Contracts.IdParam, body: jsonRequestBody(Contracts.UpdateCategory) },
      responses: { 200: jsonResponse(Contracts.Category, "Category updated"), ...errorResponses },
    }),
    async (context) =>
      context.json(
        await updateCategory(
          context.get("db"),
          context.req.valid("param").id,
          context.req.valid("json"),
        ),
        200,
      ),
  );
  // Delegate deletion checks so active and archived dishes both protect their category.
  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/categories/{id}",
      operationId: "deleteCategory",
      tags: ["Menu"],
      request: { params: Contracts.IdParam },
      responses: { 204: { description: "Empty category deleted" }, ...errorResponses },
    }),
    async (context) => {
      await deleteCategory(context.get("db"), context.req.valid("param").id);
      return context.body(null, 204);
    },
  );
  // Accept editable dish fields only; IDs, timestamps and archive state stay server-owned.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/menu",
      operationId: "createMenuItem",
      tags: ["Menu"],
      request: { body: jsonRequestBody(Contracts.CreateMenuItem) },
      responses: { 201: jsonResponse(Contracts.MenuItem, "Menu item created"), ...errorResponses },
    }),
    async (context) => {
      const [row] = await context
        .get("db")
        .insert(menuItems)
        .values(context.req.valid("json"))
        .returning();
      return context.json(serialize(row as typeof menuItems.$inferSelect), 201);
    },
  );
  // Patch dish details without modifying the snapshots held by past orders.
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/menu/{id}",
      operationId: "updateMenuItem",
      tags: ["Menu"],
      request: { params: Contracts.IdParam, body: jsonRequestBody(Contracts.UpdateMenuItem) },
      responses: { 200: jsonResponse(Contracts.MenuItem, "Menu item updated"), ...errorResponses },
    }),
    async (context) => {
      const [row] = await context
        .get("db")
        .update(menuItems)
        .set({ ...context.req.valid("json"), updatedAt: new Date() })
        .where(eq(menuItems.id, context.req.valid("param").id))
        .returning();
      if (!row) throw new DomainError(404, "ITEM_NOT_FOUND", "This menu item could not be found.");
      return context.json(serialize(row), 200);
    },
  );
  // Remove a dish from new orders while retaining its historical references.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/menu/{id}/archive",
      operationId: "archiveMenuItem",
      tags: ["Menu"],
      request: { params: Contracts.IdParam },
      responses: {
        200: jsonResponse(Contracts.MenuItem, "Removed from ordering; history kept"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(
          await setMenuItemArchived(context.get("db"), context.req.valid("param").id, true),
        ),
        200,
      ),
  );
  // Restore the dish through the same lifecycle rule used for archiving.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/menu/{id}/restore",
      operationId: "restoreMenuItem",
      tags: ["Menu"],
      request: { params: Contracts.IdParam },
      responses: {
        200: jsonResponse(Contracts.MenuItem, "Returned to the active menu"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(
          await setMenuItemArchived(context.get("db"), context.req.valid("param").id, false),
        ),
        200,
      ),
  );
  // Return no body only after guarded permanent deletion succeeds.
  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/menu/{id}",
      operationId: "deleteMenuItem",
      tags: ["Menu"],
      request: { params: Contracts.IdParam },
      responses: {
        204: { description: "Archived dish without order history deleted" },
        ...errorResponses,
      },
    }),
    async (context) => {
      await deleteMenuItem(context.get("db"), context.req.valid("param").id);
      return context.body(null, 204);
    },
  );
  // Serve the paginated CRM directory with lifetime guest aggregates.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/customers",
      operationId: "getCustomers",
      tags: ["CRM"],
      request: { query: Contracts.CustomerQuery },
      responses: {
        200: jsonResponse(Contracts.CustomerList, "Customer directory"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(await listCustomers(context.get("db"), context.req.valid("query"))),
        200,
      ),
  );
  // Combine one guest profile with their latest 50 order summaries.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/customers/{id}",
      operationId: "getCustomer",
      tags: ["CRM"],
      request: { params: Contracts.IdParam },
      responses: {
        200: jsonResponse(Contracts.CustomerDetail, "Customer and recent 50 orders"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(await getCustomerDetail(context.get("db"), context.req.valid("param").id)),
        200,
      ),
  );
  // Normalize email casing before the database enforces uniqueness.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/customers",
      operationId: "createCustomer",
      tags: ["CRM"],
      request: { body: jsonRequestBody(Contracts.CreateCustomer) },
      responses: { 201: jsonResponse(Contracts.Customer, "Customer created"), ...errorResponses },
    }),
    async (context) => {
      const input = context.req.valid("json");
      const [row] = await context
        .get("db")
        .insert(customers)
        .values({ ...input, email: input.email?.toLowerCase() })
        .returning();
      return context.json(serialize(row as typeof customers.$inferSelect), 201);
    },
  );
  // Distinguish an omitted email from an explicitly cleared email.
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/customers/{id}",
      operationId: "updateCustomer",
      tags: ["CRM"],
      request: { params: Contracts.IdParam, body: jsonRequestBody(Contracts.UpdateCustomer) },
      responses: { 200: jsonResponse(Contracts.Customer, "Customer updated"), ...errorResponses },
    }),
    async (context) => {
      const input = context.req.valid("json");
      const [row] = await context
        .get("db")
        .update(customers)
        .set({
          ...input,
          ...(input.email !== undefined ? { email: input.email?.toLowerCase() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, context.req.valid("param").id))
        .returning();
      if (!row)
        throw new DomainError(404, "CUSTOMER_NOT_FOUND", "This customer could not be found.");
      return context.json(serialize(row), 200);
    },
  );
  // Use validated filters for both result rows and pagination totals.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/orders",
      operationId: "getOrders",
      tags: ["Orders"],
      request: { query: Contracts.OrderQuery },
      responses: {
        200: jsonResponse(Contracts.OrderList, "Filtered, paginated orders"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(serialize(await listOrders(context.get("db"), context.req.valid("query"))), 200),
  );
  // Keep pricing, retry handling and all order writes inside the domain transaction.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/orders",
      operationId: "createOrder",
      tags: ["Orders"],
      request: { body: jsonRequestBody(Contracts.CreateOrder) },
      responses: {
        201: jsonResponse(
          Contracts.OrderDetail,
          "Order placed; identical retries return the original",
        ),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(serialize(await createOrder(context.get("db"), context.req.valid("json"))), 201),
  );
  // Return server-calculated actions alongside line snapshots and the audit timeline.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/orders/{id}",
      operationId: "getOrder",
      tags: ["Orders"],
      request: { params: Contracts.IdParam },
      responses: {
        200: jsonResponse(Contracts.OrderDetail, "Details and allowed actions"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(await getOrderDetail(context.get("db"), context.req.valid("param").id)),
        200,
      ),
  );
  // Validate the expected version and transition before adding an audit event.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/orders/{id}/actions",
      operationId: "applyOrderAction",
      tags: ["Orders"],
      request: { params: Contracts.IdParam, body: jsonRequestBody(Contracts.ApplyOrderAction) },
      responses: {
        200: jsonResponse(Contracts.OrderDetail, "Action applied with a version check"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(
          await applyOrderAction(
            context.get("db"),
            context.req.valid("param").id,
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );
  // Expose the singleton restaurant configuration used by checkout.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/settings",
      operationId: "getSettings",
      tags: ["Settings"],
      responses: {
        200: jsonResponse(Contracts.Settings, "Ordering configuration"),
        ...errorResponses,
      },
    }),
    async (context) => context.json(serialize(await getSettings(context.get("db"))), 200),
  );
  // Persist validated changes; new orders read them inside their own transaction.
  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/settings",
      operationId: "updateSettings",
      tags: ["Settings"],
      request: { body: jsonRequestBody(Contracts.UpdateSettings) },
      responses: {
        200: jsonResponse(Contracts.Settings, "Ordering settings saved"),
        ...errorResponses,
      },
    }),
    async (context) => {
      const [row] = await context
        .get("db")
        .update(settings)
        .set({ ...context.req.valid("json"), updatedAt: new Date() })
        .where(eq(settings.id, 1))
        .returning();
      if (!row) throw new DomainError(503, "NOT_INITIALIZED", "Seed the restaurant first.");
      return context.json(serialize(row), 200);
    },
  );
  // Keep reporting arithmetic and UTC period boundaries in the query layer.
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/summary",
      operationId: "getSummary",
      tags: ["Home"],
      request: { query: Contracts.SummaryQuery },
      responses: {
        200: jsonResponse(Contracts.Summary, "UTC reporting; revenue from completed orders only"),
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        serialize(await getDashboardSummary(context.get("db"), context.req.valid("query").days)),
        200,
      ),
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
