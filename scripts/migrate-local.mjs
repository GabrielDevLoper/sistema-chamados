import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const config = resolve(root, "wrangler.seed.jsonc");
const persistence = resolve(root, ".wrangler/state");
const runtimeEnvironment = {
  ...process.env,
  WRANGLER_WRITE_LOGS: "false",
  WRANGLER_LOG_PATH: resolve(root, ".wrangler/logs"),
  MINIFLARE_REGISTRY_PATH: resolve(root, ".wrangler/registry"),
};
const databaseArguments = [
  "site-creator-d1",
  "--local",
  "--persist-to",
  persistence,
  "--config",
  config,
];

function runWrangler(argumentsList, options = {}) {
  const result = spawnSync(process.execPath, [wrangler, ...argumentsList], {
    cwd: root,
    env: { ...runtimeEnvironment, ...options.environment },
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function query(sql) {
  const output = runWrangler(
    ["d1", "execute", ...databaseArguments, "--command", sql, "--json"],
    { capture: true }
  );
  const response = JSON.parse(output);
  return response[0]?.results ?? [];
}

function execute(sql) {
  runWrangler(["d1", "execute", ...databaseArguments, "--command", sql]);
}

const tables = new Set(
  query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(
    (row) => row.name
  )
);
const migrationRows = tables.has("d1_migrations")
  ? query("SELECT name FROM d1_migrations ORDER BY id")
  : [];

if (migrationRows.length === 0 && tables.has("organizations")) {
  const baseTables = ["desks", "services", "tickets", "users"];
  if (!baseTables.every((table) => tables.has(table))) {
    throw new Error(
      "O banco local possui uma estrutura incompleta. Faça um backup antes de recriá-lo."
    );
  }

  execute(
    `CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const appliedMigrations = tables.has("sectors")
    ? [
        "0000_overconfident_union_jack.sql",
        "0001_foamy_rocket_raccoon.sql",
        "0002_lonely_captain_midlands.sql",
        "0003_warm_the_stranger.sql",
      ]
    : [
        "0000_overconfident_union_jack.sql",
        "0001_foamy_rocket_raccoon.sql",
        "0002_lonely_captain_midlands.sql",
      ];
  const values = appliedMigrations.map((name) => `('${name}')`).join(", ");
  execute(`INSERT OR IGNORE INTO d1_migrations (name) VALUES ${values}`);
  console.log("Banco local anterior identificado e preservado.");
}

runWrangler(
  ["d1", "migrations", "apply", ...databaseArguments],
  { environment: { CI: "1" } }
);
