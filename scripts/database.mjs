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

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
// An ASCII junction works around PostgreSQL bootstrap paths on Windows.
let toolRoot = root;
if (process.platform === "win32") {
  toolRoot = resolve(
    tmpdir(),
    `odyssey-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`,
  );
  if (!existsSync(toolRoot)) symlinkSync(root, toolRoot, "junction");
  if (realpathSync(toolRoot).toLowerCase() !== realpathSync(root).toLowerCase())
    throw new Error("Database junction points to another checkout.");
}
const databaseDir = resolve(toolRoot, ".local/postgres");
const native = await import(
  `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
);
const binary = (path) => join(toolRoot, relative(root, path));
const pgCtl = binary(native.pg_ctl);
const run = (path, args) => execFileSync(path, args, { stdio: "inherit", windowsHide: true });

if (process.argv[2] === "down") {
  if (!existsSync(resolve(databaseDir, "postmaster.pid")))
    console.log("Odyssey's local database is already stopped.");
  else {
    run(pgCtl, ["-D", databaseDir, "-m", "fast", "-w", "stop"]);
    console.log("Stopped Odyssey's project-local PostgreSQL cluster.");
  }
} else {
  mkdirSync(resolve(root, ".local"), { recursive: true });
  if (!existsSync(resolve(root, ".env")))
    copyFileSync(resolve(root, ".env.example"), resolve(root, ".env"));
  if (!existsSync(resolve(root, "services/backend/.dev.vars")))
    copyFileSync(
      resolve(root, "services/backend/.dev.vars.example"),
      resolve(root, "services/backend/.dev.vars"),
    );
  if (!existsSync(resolve(databaseDir, "PG_VERSION"))) {
    const passwordFile = resolve(toolRoot, ".local/init-password");
    writeFileSync(passwordFile, "odyssey_local", { mode: 0o600 });
    try {
      run(binary(native.initdb), [
        "-D",
        databaseDir,
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
  const probe = new pg.Client({ connectionString, connectionTimeoutMillis: 2000 });
  let alreadyRunning = false;
  try {
    await probe.connect();
    alreadyRunning = true;
  } catch {
    /* Dedicated local port. */
  } finally {
    await probe.end();
  }
  if (!alreadyRunning)
    run(pgCtl, [
      "-D",
      databaseDir,
      "-l",
      resolve(toolRoot, ".local/postgres.log"),
      "-o",
      "-p 55432 -h 127.0.0.1",
      "-w",
      "start",
    ]);
  const owner = new pg.Client({ connectionString });
  await owner.connect();
  try {
    const result = await owner.query("SHOW data_directory");
    if (
      realpathSync(result.rows[0].data_directory).toLowerCase() !==
      realpathSync(databaseDir).toLowerCase()
    )
      throw new Error(
        "Port 55432 belongs to another PostgreSQL cluster. No database changes were made.",
      );
    for (const database of ["odyssey", "odyssey_test"]) {
      const found = await owner.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
      if (!found.rowCount) await owner.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await owner.end();
  }
  const pid = Number(readFileSync(resolve(databaseDir, "postmaster.pid"), "utf8").split("\n")[0]);
  console.log(
    `PostgreSQL ready at 127.0.0.1:55432 (PID ${pid}). Databases: odyssey, odyssey_test.`,
  );
  console.log("Data lives in .local/postgres. No existing databases or services are used.");
}
