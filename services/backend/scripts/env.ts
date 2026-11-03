import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const env = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(env)) process.loadEnvFile(env);
export const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://odyssey:odyssey_local@127.0.0.1:55432/odyssey";
export function requireDemoDatabase(url: string) {
  if (!["/odyssey", "/odyssey_test"].includes(new URL(url).pathname))
    throw new Error(
      "Write scripts are scoped to a database named odyssey or odyssey_test. Use a dedicated database.",
    );
}
