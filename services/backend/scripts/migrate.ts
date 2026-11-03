import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connectDatabase } from "../src/db/client";
import { databaseUrl, requireDemoDatabase } from "./env";

requireDemoDatabase(databaseUrl);
const { db, pool } = connectDatabase(databaseUrl);
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  console.log("Odyssey migrations applied.");
} finally {
  await pool.end();
}
