import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** Create a small request-scoped pool; the Worker closes it after its response completes. */
export function connectDatabase(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  return { db: drizzle(pool, { schema }), pool };
}

export type Database = ReturnType<typeof connectDatabase>["db"];
/** Reuse Drizzle's transaction type instead of maintaining a parallel database interface. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
