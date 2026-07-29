import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const result = spawnSync(
  process.execPath,
  [
    resolve(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "execute",
    "site-creator-d1",
    "--local",
    "--persist-to",
    resolve(root, ".wrangler/state"),
    "--config",
    resolve(root, "wrangler.seed.jsonc"),
    "--file",
    resolve(root, "db/seeds/development-admin.sql"),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_LOG_PATH: resolve(root, ".wrangler/logs"),
      MINIFLARE_REGISTRY_PATH: resolve(root, ".wrangler/registry"),
    },
    stdio: "inherit",
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
