import {
  hashPassword,
  type AuthenticatedUser,
  verifyPassword,
} from "./auth";
import { getD1 } from "./runtime";

const LOGIN_ERROR = "E-mail ou senha inválidos.";

type LoginRow = AuthenticatedUser & {
  passwordHash: string | null;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  organizationStatus: string | null;
};

export async function verifyCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await getD1()
    .prepare(
      `SELECT
        users.id,
        users.organization_id AS organizationId,
        users.name,
        users.email,
        users.role,
        users.password_hash AS passwordHash,
        users.status,
        users.failed_login_attempts AS failedLoginAttempts,
        users.locked_until AS lockedUntil,
        organizations.status AS organizationStatus
       FROM users
       LEFT JOIN organizations ON organizations.id = users.organization_id
       WHERE users.email = ? LIMIT 1`
    )
    .bind(normalizedEmail)
    .first<LoginRow>();

  if (!row?.passwordHash) {
    await hashPassword(password.slice(0, 128).padEnd(12, "!"));
    throw new Error(LOGIN_ERROR);
  }
  const validPassword = await verifyPassword(password, row.passwordHash);
  const locked = row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now();
  const active =
    row.status === "active" &&
    (row.role !== "organization" || row.organizationStatus === "active");

  if (!validPassword || locked || !active) {
    const attempts = row.failedLoginAttempts + 1;
    await getD1()
      .prepare(
        `UPDATE users SET
          failed_login_attempts = ?,
          locked_until = CASE
            WHEN ? >= 5 THEN datetime('now', '+15 minutes')
            ELSE locked_until
          END,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(attempts, attempts, row.id)
      .run();
    throw new Error(LOGIN_ERROR);
  }

  await getD1()
    .prepare(
      `UPDATE users SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(row.id)
    .run();
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    email: row.email,
    role: row.role,
  } satisfies AuthenticatedUser;
}

export async function createInitialPlatformAdmin(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}) {
  const count = await getD1()
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'platform_admin'")
    .first<{ total: number }>();
  if ((count?.total ?? 0) > 0) {
    throw new Error("O administrador inicial já foi configurado.");
  }
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (name.length < 2 || name.length > 100) throw new Error("Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  const passwordHash = await hashPassword(password);
  await getD1()
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, status, password_changed_at)
       VALUES (?, ?, ?, 'platform_admin', 'active', CURRENT_TIMESTAMP)`
    )
    .bind(name, email, passwordHash)
    .run();
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
) {
  const user = await getD1()
    .prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ password_hash: string | null }>();
  if (!user?.password_hash || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw new Error("A senha atual não confere.");
  }
  const passwordHash = await hashPassword(newPassword);
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(passwordHash, userId),
    getD1()
      .prepare(
        `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND revoked_at IS NULL`
      )
      .bind(userId),
  ]);
}

export async function listActiveSessions(userId: number) {
  const { results } = await getD1()
    .prepare(
      `SELECT id, device_label, last_seen_at, expires_at, created_at
       FROM sessions WHERE user_id = ? AND revoked_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY last_seen_at DESC`
    )
    .bind(userId)
    .all<{
      id: string;
      device_label: string | null;
      last_seen_at: string;
      expires_at: string;
      created_at: string;
    }>();
  return results;
}
