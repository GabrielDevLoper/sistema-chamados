import { env } from "cloudflare:workers";
import { jwtVerify, SignJWT } from "jose";
import { getD1 } from "./runtime";

export type UserRole = "platform_admin" | "organization";
export type AuthenticatedUser = {
  id: number;
  organizationId: number | null;
  name: string;
  email: string;
  role: UserRole;
};

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401
  ) {
    super(message);
  }
}

const COOKIE_NAME = "__Host-queue_session";
const LOCAL_COOKIE_NAME = "queue_session";
const JWT_ISSUER = "sistema-chamados";
const JWT_AUDIENCE = "sistema-chamados-users";
const SESSION_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();

type RuntimeSecrets = {
  JWT_SECRET?: string;
  ADMIN_SETUP_TOKEN?: string;
};

function runtimeSecrets() {
  return env as unknown as RuntimeSecrets;
}

function signingKey() {
  const secret = runtimeSecrets().JWT_SECRET;
  if (!secret || encoder.encode(secret).byteLength < 32) {
    throw new Error("Configure JWT_SECRET com pelo menos 32 caracteres.");
  }
  return encoder.encode(secret);
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256
  );
  return new Uint8Array(bits);
}

export function validatePassword(password: string) {
  if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
  if (password.length > 128) throw new Error("A senha deve ter no máximo 128 caracteres.");
}

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${base64url(salt)}$${base64url(hash)}`;
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, rawIterations, rawSalt, rawHash] = encodedHash.split("$");
  const iterations = Number(rawIterations);
  if (
    algorithm !== "pbkdf2_sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !rawSalt ||
    !rawHash
  ) {
    return false;
  }
  const expected = fromBase64url(rawHash);
  const actual = await derivePassword(password, fromBase64url(rawSalt), iterations);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

async function sha256(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function cookieValue(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const values = new Map(
    cookies.split(";").map((item) => {
      const [name, ...value] = item.trim().split("=");
      return [name, value.join("=")];
    })
  );
  return values.get(COOKIE_NAME) ?? values.get(LOCAL_COOKIE_NAME) ?? null;
}

export function sessionCookie(token: string, request: Request, maxAge = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === "https:";
  const name = secure ? COOKIE_NAME : LOCAL_COOKIE_NAME;
  return `${name}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function clearSessionCookies(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return [
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
    `${LOCAL_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
  ];
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new AuthenticationError("Origem da requisição ausente.", 403);
  }
  if (new URL(origin).origin !== new URL(request.url).origin) {
    throw new AuthenticationError("Origem da requisição inválida.", 403);
  }
}

export async function createSession(user: AuthenticatedUser, request: Request) {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + SESSION_SECONDS) * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const token = await new SignJWT({
    role: user.role,
    organizationId: user.organizationId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(String(user.id))
    .setJti(id)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_SECONDS)
    .sign(signingKey());
  await getD1()
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, device_label, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      user.id,
      await sha256(token),
      request.headers.get("user-agent")?.slice(0, 180) ?? null,
      expiresAt
    )
    .run();
  return { token, expiresAt };
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser> {
  const token = cookieValue(request);
  if (!token) throw new AuthenticationError("Autenticação necessária.");
  let payload;
  try {
    ({ payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }));
  } catch {
    throw new AuthenticationError("Sessão inválida ou expirada.");
  }
  const userId = Number(payload.sub);
  if (!payload.jti || !Number.isInteger(userId)) {
    throw new AuthenticationError("Sessão inválida.");
  }
  const row = await getD1()
    .prepare(
      `SELECT
        users.id, users.organization_id, users.name, users.email, users.role,
        users.status, organizations.status AS organization_status
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       LEFT JOIN organizations ON organizations.id = users.organization_id
       WHERE sessions.id = ? AND sessions.user_id = ? AND sessions.token_hash = ?
         AND sessions.revoked_at IS NULL AND sessions.expires_at > CURRENT_TIMESTAMP
       LIMIT 1`
    )
    .bind(payload.jti, userId, await sha256(token))
    .first<{
      id: number;
      organization_id: number | null;
      name: string;
      email: string;
      role: UserRole;
      status: string;
      organization_status: string | null;
    }>();
  if (!row || row.status !== "active") {
    throw new AuthenticationError("Sessão inválida ou conta suspensa.");
  }
  if (row.role === "organization" && row.organization_status !== "active") {
    throw new AuthenticationError("Organização indisponível.", 403);
  }
  await getD1()
    .prepare(
      `UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP
       WHERE id = ? AND last_seen_at < datetime('now', '-15 minutes')`
    )
    .bind(payload.jti)
    .run();
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export async function revokeCurrentSession(request: Request) {
  const token = cookieValue(request);
  if (!token) return;
  await getD1()
    .prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
    .bind(await sha256(token))
    .run();
}

export function adminSetupToken() {
  return runtimeSecrets().ADMIN_SETUP_TOKEN ?? null;
}
