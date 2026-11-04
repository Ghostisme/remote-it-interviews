/** Start or stop the checkout-owned PostgreSQL cluster without using another local database service. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const workspaceRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
// An ASCII junction works around PostgreSQL bootstrap paths on Windows.
let postgresToolRoot = workspaceRoot;
if (process.platform === "win32") {
  postgresToolRoot = resolve(
    tmpdir(),
    `odyssey-${createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12)}`,
  );
  if (!existsSync(postgresToolRoot)) symlinkSync(workspaceRoot, postgresToolRoot, "junction");
  if (realpathSync(postgresToolRoot).toLowerCase() !== realpathSync(workspaceRoot).toLowerCase())
    throw new Error("Database junction points to another checkout.");
}
const databaseDirectory = resolve(postgresToolRoot, ".local/postgres");
const postgresBinaries = await import(
  `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
);
/** Translate a package binary path through the Windows-compatible checkout junction. */
const resolveBinaryPath = (binaryPath) =>
  join(postgresToolRoot, relative(workspaceRoot, binaryPath));
const pgCtlPath = resolveBinaryPath(postgresBinaries.pg_ctl);
/** Run PostgreSQL tools with inherited logs and no extra Windows console window. */
const runPostgresCommand = (binaryPath, commandArguments) =>
  execFileSync(binaryPath, commandArguments, { stdio: "inherit", windowsHide: true });

if (process.argv[2] === "down") {
  if (!existsSync(resolve(databaseDirectory, "postmaster.pid")))
    console.log("Odyssey's local database is already stopped.");
  else {
    runPostgresCommand(pgCtlPath, ["-D", databaseDirectory, "-m", "fast", "-w", "stop"]);
    console.log("Stopped Odyssey's project-local PostgreSQL cluster.");
  }
} else {
  mkdirSync(resolve(workspaceRoot, ".local"), { recursive: true });
  if (!existsSync(resolve(workspaceRoot, ".env")))
    copyFileSync(resolve(workspaceRoot, ".env.example"), resolve(workspaceRoot, ".env"));
  if (!existsSync(resolve(workspaceRoot, "services/backend/.dev.vars")))
    copyFileSync(
      resolve(workspaceRoot, "services/backend/.dev.vars.example"),
      resolve(workspaceRoot, "services/backend/.dev.vars"),
    );
  if (!existsSync(resolve(databaseDirectory, "PG_VERSION"))) {
    // Bootstrap credentials exist only for initialization and are removed even if initdb fails.
    const passwordFile = resolve(postgresToolRoot, ".local/init-password");
    writeFileSync(passwordFile, "odyssey_local", { mode: 0o600 });
    try {
      runPostgresCommand(resolveBinaryPath(postgresBinaries.initdb), [
        "-D",
        databaseDirectory,
        "-U",
        "odyssey",
        `--pwfile=${passwordFile}`,
        "--encoding=UTF8",
        "--locale=C",
        "--auth=scram-sha-256",
      ]);
    } finally {
      rmSync(passwordFile, { force: true });
    }
  }
  const connectionString = "postgresql://odyssey:odyssey_local@127.0.0.1:55432/postgres";
  const connectionProbe = new pg.Client({ connectionString, connectionTimeoutMillis: 2000 });
  let alreadyRunning = false;
  try {
    await connectionProbe.connect();
    alreadyRunning = true;
  } catch {
    // An unreachable dedicated port means this checkout may need to start its cluster.
  } finally {
    await connectionProbe.end();
  }
  if (!alreadyRunning)
    runPostgresCommand(pgCtlPath, [
      "-D",
      databaseDirectory,
      "-l",
      resolve(postgresToolRoot, ".local/postgres.log"),
      "-o",
      "-p 55432 -h 127.0.0.1",
      "-w",
      "start",
    ]);
  const bootstrapClient = new pg.Client({ connectionString });
  await bootstrapClient.connect();
  try {
    // Verify ownership before issuing any CREATE DATABASE statement on the listening server.
    const dataDirectoryResult = await bootstrapClient.query("SHOW data_directory");
    if (
      realpathSync(dataDirectoryResult.rows[0].data_directory).toLowerCase() !==
      realpathSync(databaseDirectory).toLowerCase()
    )
      throw new Error(
        "Port 55432 belongs to another PostgreSQL cluster. No database changes were made.",
      );
    // These fixed identifiers are the only databases this bootstrap can create.
    for (const databaseName of ["odyssey", "odyssey_test"]) {
      const existingDatabase = await bootstrapClient.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [databaseName],
      );
      if (!existingDatabase.rowCount)
        await bootstrapClient.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await bootstrapClient.end();
  }
  const processId = Number(
    readFileSync(resolve(databaseDirectory, "postmaster.pid"), "utf8").split("\n")[0],
  );
  console.log(
    `PostgreSQL ready at 127.0.0.1:55432 (PID ${processId}). Databases: odyssey, odyssey_test.`,
  );
  console.log("Data lives in .local/postgres. No existing databases or services are used.");
}
