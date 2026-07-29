import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("entrega rotas públicas e painéis autenticados por organização", async () => {
  const [queueApp, clientPage, displayPage, organizationHome] = await Promise.all([
    readFile(new URL("app/queue-app.tsx", root), "utf8"),
    readFile(new URL("app/fila/[slug]/cliente/page.tsx", root), "utf8"),
    readFile(new URL("app/fila/[slug]/painel/page.tsx", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
  ]);

  assert.match(clientPage, /getOrganizationBySlug/);
  assert.match(displayPage, /getOrganizationBySlug/);
  assert.match(queueApp, /queue\.services\.map/);
  assert.match(queueApp, /queue\.desks\.map/);
  assert.match(queueApp, /queue-desk:/);
  assert.match(queueApp, /organization\.primaryColor/);
  assert.match(organizationHome, /Atender a fila/);
  assert.doesNotMatch(queueApp, /Alta Serra/);
});

test("usa migrations versionadas e isolamento multiorganização", async () => {
  const [migration, runtime, queue, publicRoute, hosting] = await Promise.all([
    readFile(new URL("drizzle/0002_lonely_captain_midlands.sql", root), "utf8"),
    readFile(new URL("db/runtime.ts", root), "utf8"),
    readFile(new URL("db/queue.ts", root), "utf8"),
    readFile(new URL("app/api/public/[slug]/tickets/route.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE `organizations`/);
  assert.match(migration, /CREATE TABLE `ticket_sequences`/);
  assert.match(migration, /INSERT INTO `organizations`/);
  assert.doesNotMatch(runtime, /CREATE TABLE IF NOT EXISTS/);
  assert.match(queue, /WHERE organization_id = \?/);
  assert.match(queue, /ON CONFLICT\(organization_id, service_date\)/);
  assert.match(publicRoute, /getOrganizationBySlug/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "R2"/);
});

test("protege contas com JWT, hash de senha e sessão revogável", async () => {
  const [auth, login, platformRoute, privateTickets] = await Promise.all([
    readFile(new URL("db/auth.ts", root), "utf8"),
    readFile(new URL("db/login.ts", root), "utf8"),
    readFile(new URL("app/api/platform/organizations/route.ts", root), "utf8"),
    readFile(new URL("app/api/tickets/route.ts", root), "utf8"),
  ]);

  assert.match(auth, /new SignJWT/);
  assert.match(auth, /jwtVerify/);
  assert.match(auth, /PBKDF2_ITERATIONS = 600_000/);
  assert.match(auth, /HttpOnly; SameSite=Strict/);
  assert.match(auth, /sessions\.revoked_at IS NULL/);
  assert.match(login, /failed_login_attempts/);
  assert.match(platformRoute, /authorizePlatformAdmin\(request\)/);
  assert.match(privateTickets, /authorizeOrganization\(request\)/);
  assert.doesNotMatch(auth, /ChatGPT|oai-authenticated/);
});

test("mantém a hidratação determinística", async () => {
  const queueApp = await readFile(new URL("app/queue-app.tsx", root), "utf8");
  assert.match(queueApp, /useState<Date \| null>\(null\)/);
  assert.match(queueApp, /const updateClock = \(\) => setNow\(new Date\(\)\)/);
  assert.doesNotMatch(queueApp, /useState\(new Date\(\)\)/);
});

test("gera o artefato de produção", async () => {
  await access(new URL("dist/server/index.js", root));
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
