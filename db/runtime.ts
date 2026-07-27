import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) {
    throw new Error("A fila ainda não está conectada ao banco de dados.");
  }
  return env.DB;
}

export async function ensureQueueSchema() {
  const database = getD1();
  await database.batch([
    database.prepare(
      `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        service TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'waiting',
        desk INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        called_at TEXT,
        finished_at TEXT
      )`
    ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS tickets_queue_idx ON tickets(status, priority, created_at)"
    ),
    database.prepare(
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    database.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('desk_count', '4')"
    ),
  ]);
}

export async function getDeskCount() {
  const row = await getD1()
    .prepare("SELECT value FROM settings WHERE key = 'desk_count'")
    .first<{ value: string }>();
  const value = Number(row?.value ?? 4);
  return Number.isInteger(value) && value >= 1 && value <= 50 ? value : 4;
}
