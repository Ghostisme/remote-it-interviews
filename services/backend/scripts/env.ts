/** Load the workspace environment for command-line database scripts and enforce their database scope. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
/** Resolve the script connection string, defaulting to the dedicated local demo database. */
export const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://odyssey:odyssey_local@127.0.0.1:55432/odyssey";
/** Refuse writes unless the connection explicitly names one of the two assignment databases. */
export function requireDemoDatabase(connectionString: string) {
  if (!["/odyssey", "/odyssey_test"].includes(new URL(connectionString).pathname))
    throw new Error(
      "Write scripts are scoped to a database named odyssey or odyssey_test. Use a dedicated database.",
    );
}
