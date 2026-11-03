import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const databaseDir = resolve(root, ".local/postgres");
const cluster = new EmbeddedPostgres({
  databaseDir, user: "odyssey", password: "odyssey_local", port: 54329,
  persistent: true, autoRehydrateSymlinks: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {}, onError: (message) => console.error(String(message)),
});

if (process.argv[2] === "down") {
  if (!existsSync(resolve(databaseDir, "postmaster.pid"))) {
    console.log("Odyssey's local database is already stopped.");
  } else {
    await cluster.stop();
    console.log("Stopped Odyssey's project-local PostgreSQL cluster.");
  }
} else {
  mkdirSync(resolve(root, ".local"), { recursive: true });
  if (!existsSync(resolve(root, ".env"))) copyFileSync(resolve(root, ".env.example"), resolve(root, ".env"));
  if (!existsSync(resolve(root, "services/backend/.dev.vars"))) {
    copyFileSync(resolve(root, "services/backend/.dev.vars.example"), resolve(root, "services/backend/.dev.vars"));
  }
  if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await cluster.initialise();
  const client = new pg.Client({ connectionString: "postgresql://odyssey:odyssey_local@127.0.0.1:54329/postgres", connectionTimeoutMillis: 2000 });
  let alreadyRunning = false;
  try { await client.connect(); alreadyRunning = true; await client.end(); } catch { /* Start only our cluster on its dedicated port. */ }
  if (!alreadyRunning) await cluster.start();
  const owner = new pg.Client({ connectionString: "postgresql://odyssey:odyssey_local@127.0.0.1:54329/postgres" });
  await owner.connect();
  const dataPath = await owner.query("SHOW data_directory");
  const actual = resolve(dataPath.rows[0].data_directory).toLowerCase();
  if (actual !== databaseDir.toLowerCase()) throw new Error("Port 54329 is occupied by a different PostgreSQL cluster. No changes were made.");
  for (const database of ["odyssey", "odyssey_test"]) {
    const found = await owner.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!found.rowCount) await owner.query(`CREATE DATABASE "${database}"`);
  }
  await owner.end();
  const pid = Number(readFileSync(resolve(databaseDir, "postmaster.pid"), "utf8").split("\n")[0]);
  console.log(`PostgreSQL ready at 127.0.0.1:54329 (PID ${pid}). Databases: odyssey, odyssey_test.`);
  console.log("Data lives in .local/postgres. No existing databases or services are used.");
}
