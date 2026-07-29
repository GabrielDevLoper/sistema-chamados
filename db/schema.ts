import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable(
  "organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tradeName: text("trade_name").notNull(),
    slug: text("slug").notNull(),
    businessType: text("business_type").notNull().default("other"),
    logoKey: text("logo_key"),
    primaryColor: text("primary_color").notNull().default("#123D3A"),
    timezone: text("timezone").notNull().default("America/Maceio"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)]
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").references(
      () => organizations.id,
      { onDelete: "cascade" }
    ),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    lastLoginAt: text("last_login_at"),
    passwordChangedAt: text("password_changed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_one_account_per_organization")
      .on(table.organizationId)
      .where(sql`${table.role} = 'organization'`),
  ]
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label"),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_active_idx").on(
      table.userId,
      table.revokedAt,
      table.expiresAt
    ),
  ]
);

export const accountTokens = sqliteTable(
  "account_tokens",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("account_tokens_hash_unique").on(table.tokenHash),
    index("account_tokens_user_purpose_idx").on(table.userId, table.purpose),
  ]
);

export const services = sqliteTable(
  "services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ticketPrefix: text("ticket_prefix").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("services_org_name_unique").on(
      table.organizationId,
      table.name
    ),
    index("services_org_active_sort_idx").on(
      table.organizationId,
      table.active,
      table.sortOrder
    ),
  ]
);

export const sectors = sqliteTable(
  "sectors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sectors_org_name_unique").on(table.organizationId, table.name),
    index("sectors_org_active_sort_idx").on(
      table.organizationId,
      table.active,
      table.sortOrder
    ),
  ]
);

export const sectorServices = sqliteTable(
  "sector_services",
  {
    sectorId: integer("sector_id")
      .notNull()
      .references(() => sectors.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.sectorId, table.serviceId] }),
    index("sector_services_service_idx").on(table.serviceId),
  ]
);

export const desks = sqliteTable(
  "desks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sectorId: integer("sector_id")
      .references(() => sectors.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    number: integer("number").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("desks_org_number_unique").on(
      table.organizationId,
      table.number
    ),
    index("desks_org_active_idx").on(table.organizationId, table.active),
    index("desks_org_sector_active_idx").on(
      table.organizationId,
      table.sectorId,
      table.active
    ),
  ]
);

export const ticketSequences = sqliteTable(
  "ticket_sequences",
  {
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    serviceDate: text("service_date").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.serviceDate] })]
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .default(1)
      .references(() => organizations.id, { onDelete: "restrict" }),
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "restrict",
    }),
    deskId: integer("desk_id").references(() => desks.id, {
      onDelete: "restrict",
    }),
    sectorId: integer("sector_id").references(() => sectors.id, {
      onDelete: "restrict",
    }),
    sector: text("sector"),
    serviceDate: text("service_date"),
    sequenceNumber: integer("sequence_number").notNull().default(0),
    code: text("code").notNull(),
    service: text("service").notNull(),
    priority: integer("priority").notNull().default(0),
    status: text("status").notNull().default("waiting"),
    desk: integer("desk"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    calledAt: text("called_at"),
    finishedAt: text("finished_at"),
  },
  (table) => [
    index("tickets_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
    index("tickets_org_service_created_idx").on(
      table.organizationId,
      table.serviceId,
      table.createdAt
    ),
    uniqueIndex("tickets_org_date_code_unique").on(
      table.organizationId,
      table.serviceDate,
      table.code
    ),
  ]
);

export const organizationSettings = sqliteTable(
  "organization_settings",
  {
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.key] })]
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    organizationId: integer("organization_id").references(
      () => organizations.id,
      { onDelete: "set null" }
    ),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_logs_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
  ]
);
