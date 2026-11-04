/** Generate reviewable PostgreSQL migrations from the canonical persisted schema. */
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
});
