import { getD1 } from "./runtime";
import { getOrganizationById, listOrganizations } from "./organizations";
import type { Organization } from "./types";
import { hashPassword } from "./auth";

export type OrganizationSummary = Organization & {
  accountEmail: string | null;
  accountName: string | null;
  accountStatus: string | null;
  lastLoginAt: string | null;
  activeSessions: number;
};

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeInput(input: {
  tradeName?: unknown;
  slug?: unknown;
  businessType?: unknown;
  primaryColor?: unknown;
  timezone?: unknown;
  accountName?: unknown;
  accountEmail?: unknown;
  accountPassword?: unknown;
  status?: unknown;
}) {
  const tradeName = String(input.tradeName ?? "").trim();
  const slug = String(input.slug ?? "").trim().toLowerCase();
  const businessType = String(input.businessType ?? "other").trim() || "other";
  const primaryColor = String(input.primaryColor ?? "#1F5B55").trim().toUpperCase();
  const timezone = String(input.timezone ?? "America/Maceio").trim();
  const accountName = String(input.accountName ?? tradeName).trim();
  const accountEmail = String(input.accountEmail ?? "").trim().toLowerCase();
  const accountPassword = String(input.accountPassword ?? "");
  const status = String(input.status ?? "pending").trim();

  if (tradeName.length < 2 || tradeName.length > 100) {
    throw new Error("Informe um nome fantasia entre 2 e 100 caracteres.");
  }
  if (!SLUG.test(slug) || slug.length > 80) {
    throw new Error("O endereço deve usar letras minúsculas, números e hífens.");
  }
  if (!HEX_COLOR.test(primaryColor)) {
    throw new Error("Informe a cor primária no formato #RRGGBB.");
  }
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
  } catch {
    throw new Error("Informe um fuso horário válido.");
  }
  if (accountName.length < 2 || accountName.length > 100) {
    throw new Error("Informe o nome do responsável pela conta.");
  }
  if (!EMAIL.test(accountEmail) || accountEmail.length > 254) {
    throw new Error("Informe um e-mail de acesso válido.");
  }
  if (!["pending", "active", "suspended"].includes(status)) {
    throw new Error("Selecione um status válido.");
  }

  return {
    tradeName,
    slug,
    businessType,
    primaryColor,
    timezone,
    accountName,
    accountEmail,
    accountPassword,
    status: status as Organization["status"],
  };
}

export async function listOrganizationSummaries(): Promise<OrganizationSummary[]> {
  const organizations = await listOrganizations();
  if (!organizations.length) return [];
  const { results } = await getD1()
    .prepare(
      `SELECT
        users.organization_id, users.name, users.email, users.status,
        users.last_login_at,
        COUNT(sessions.id) AS active_sessions
       FROM users
       LEFT JOIN sessions ON sessions.user_id = users.id
         AND sessions.revoked_at IS NULL AND sessions.expires_at > CURRENT_TIMESTAMP
       WHERE users.role = 'organization' AND users.organization_id IS NOT NULL
       GROUP BY users.id`
    )
    .all<{
      organization_id: number;
      name: string;
      email: string;
      status: string;
      last_login_at: string | null;
      active_sessions: number;
    }>();
  const accounts = new Map(results.map((account) => [account.organization_id, account]));
  return organizations.map((organization) => ({
    ...organization,
    accountEmail: accounts.get(organization.id)?.email ?? null,
    accountName: accounts.get(organization.id)?.name ?? null,
    accountStatus: accounts.get(organization.id)?.status ?? null,
    lastLoginAt: accounts.get(organization.id)?.last_login_at ?? null,
    activeSessions: accounts.get(organization.id)?.active_sessions ?? 0,
  }));
}

export async function getOrganizationSummary(
  id: number
): Promise<OrganizationSummary | null> {
  const organization = await getOrganizationById(id, { includeInactive: true });
  if (!organization) return null;
  const account = await getD1()
    .prepare(
      `SELECT
        users.name, users.email, users.status, users.last_login_at,
        COUNT(sessions.id) AS active_sessions
       FROM users
       LEFT JOIN sessions ON sessions.user_id = users.id
         AND sessions.revoked_at IS NULL AND sessions.expires_at > CURRENT_TIMESTAMP
       WHERE organization_id = ? AND role = 'organization' LIMIT 1`
    )
    .bind(id)
    .first<{
      name: string;
      email: string;
      status: string;
      last_login_at: string | null;
      active_sessions: number;
    }>();
  return {
    ...organization,
    accountEmail: account?.email ?? null,
    accountName: account?.name ?? null,
    accountStatus: account?.status ?? null,
    lastLoginAt: account?.last_login_at ?? null,
    activeSessions: account?.active_sessions ?? 0,
  };
}

export async function createOrganization(
  input: Parameters<typeof normalizeInput>[0],
  actorUserId?: number
) {
  const values = normalizeInput(input);
  const passwordHash = await hashPassword(values.accountPassword);
  const database = getD1();
  const organization = await database
    .prepare(
      `INSERT INTO organizations (
        trade_name, slug, business_type, primary_color, timezone, status
      ) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      values.tradeName,
      values.slug,
      values.businessType,
      values.primaryColor,
      values.timezone,
      values.status
    )
    .first<{ id: number }>();
  if (!organization) throw new Error("Não foi possível cadastrar a organização.");

  try {
    await database.batch([
      database
        .prepare(
          `INSERT INTO users (
            organization_id, name, email, password_hash, role, status,
            password_changed_at
          ) VALUES (?, ?, ?, ?, 'organization', ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          organization.id,
          values.accountName,
          values.accountEmail,
          passwordHash,
          values.status === "active" ? "active" : values.status
        ),
      database
        .prepare(
          `INSERT INTO services (
            organization_id, name, ticket_prefix, sort_order
          ) VALUES (?, 'Atendimento geral', 'A', 1)`
        )
        .bind(organization.id),
      database
        .prepare(
          `INSERT INTO desks (organization_id, name, number)
           VALUES (?, 'Guichê 01', 1)`
        )
        .bind(organization.id),
      database
        .prepare(
          `INSERT INTO audit_logs (
            actor_user_id, organization_id, action, entity_type, entity_id, metadata
          ) VALUES (?, ?, 'organization.created', 'organization', ?, ?)`
        )
        .bind(
          actorUserId ?? null,
          organization.id,
          String(organization.id),
          JSON.stringify({ accountEmail: values.accountEmail })
        ),
    ]);
  } catch (error) {
    await database
      .prepare("DELETE FROM organizations WHERE id = ?")
      .bind(organization.id)
      .run();
    throw error;
  }
  return getOrganizationSummary(organization.id);
}

export async function updateOrganization(
  id: number,
  input: Parameters<typeof normalizeInput>[0],
  actorUserId?: number
) {
  const values = normalizeInput(input);
  const database = getD1();
  const existing = await getOrganizationSummary(id);
  if (!existing) throw new Error("Organização não encontrada.");

  const passwordHash = values.accountPassword
    ? await hashPassword(values.accountPassword)
    : null;
  if (!existing.accountEmail && !passwordHash) {
    throw new Error("Defina uma senha inicial para criar a conta da organização.");
  }
  const accountStatement = existing.accountEmail
    ? database
        .prepare(
          `UPDATE users SET
            name = ?, email = ?,
            status = CASE
              WHEN ? = 'suspended' THEN 'suspended'
              WHEN ? = 'active' THEN 'active'
              ELSE 'pending'
            END,
            updated_at = CURRENT_TIMESTAMP
           WHERE organization_id = ? AND role = 'organization'`
        )
        .bind(
          values.accountName,
          values.accountEmail,
          values.status,
          values.status,
          id
        )
    : database
        .prepare(
          `INSERT INTO users (
            organization_id, name, email, password_hash, role, status,
            password_changed_at
          ) VALUES (?, ?, ?, ?, 'organization', ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          id,
          values.accountName,
          values.accountEmail,
          passwordHash,
          values.status === "active" ? "active" : values.status
        );
  const statements = [
    database
      .prepare(
        `UPDATE organizations SET
          trade_name = ?, slug = ?, business_type = ?, primary_color = ?,
          timezone = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        values.tradeName,
        values.slug,
        values.businessType,
        values.primaryColor,
        values.timezone,
        values.status,
        id
      ),
    ...(passwordHash
      ? [
          database
            .prepare(
              `UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP,
                failed_login_attempts = 0, locked_until = NULL,
                updated_at = CURRENT_TIMESTAMP
               WHERE organization_id = ? AND role = 'organization'`
            )
            .bind(passwordHash, id),
          database
            .prepare(
              `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
               WHERE user_id IN (
                 SELECT id FROM users WHERE organization_id = ? AND role = 'organization'
               ) AND revoked_at IS NULL`
            )
            .bind(id),
        ]
      : []),
    accountStatement,
    database
      .prepare(
        `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id IN (
           SELECT id FROM users WHERE organization_id = ? AND role = 'organization'
         ) AND revoked_at IS NULL AND ? = 'suspended'`
      )
      .bind(id, values.status),
    database
      .prepare(
        `INSERT INTO audit_logs (
          actor_user_id, organization_id, action, entity_type, entity_id, metadata
        ) VALUES (?, ?, 'organization.updated', 'organization', ?, ?)`
      )
      .bind(
        actorUserId ?? null,
        id,
        String(id),
        JSON.stringify({ previousStatus: existing.status, status: values.status })
      ),
  ];
  await database.batch(statements);
  return getOrganizationSummary(id);
}
