import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  service: text("service").notNull(),
  priority: integer("priority").notNull().default(0),
  status: text("status").notNull().default("waiting"),
  desk: integer("desk"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  calledAt: text("called_at"),
  finishedAt: text("finished_at"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
