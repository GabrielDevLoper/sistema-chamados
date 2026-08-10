import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("entrega rotas públicas e painéis autenticados por organização", async () => {
  const [queueApp, clientPage, displayPage, organizationHome, layout] = await Promise.all([
    readFile(new URL("app/queue-app.tsx", root), "utf8"),
    readFile(new URL("app/fila/[slug]/cliente/page.tsx", root), "utf8"),
    readFile(new URL("app/fila/[slug]/painel/page.tsx", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(clientPage, /getOrganizationBySlug/);
  assert.match(displayPage, /getOrganizationBySlug/);
  assert.match(queueApp, /queue\.services\.map/);
  assert.match(queueApp, /queue\.desks\.map/);
  assert.match(queueApp, /queue-desk:/);
  assert.match(queueApp, /organization\.primaryColor/);
  assert.match(queueApp, /Notification\.requestPermission/);
  assert.match(queueApp, /new Notification\(`Nova senha:/);
  assert.match(queueApp, /knownTicketIds/);
  assert.match(organizationHome, /Atender a fila/);
  assert.doesNotMatch(queueApp, /Alta Serra/);
  assert.match(layout, /Atendimento simples\. Filas organizadas\./);
  assert.doesNotMatch(layout, /Cartório|cartório/);
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

test("organiza guichês por setores e limita os serviços elegíveis", async () => {
  const [migration, historyMigration, schema, queue, management, sectorsRoute, servicesRoute, desksRoute, settings] = await Promise.all([
    readFile(new URL("drizzle/0003_warm_the_stranger.sql", root), "utf8"),
    readFile(new URL("drizzle/0004_cuddly_warbound.sql", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/queue.ts", root), "utf8"),
    readFile(new URL("app/app/management.tsx", root), "utf8"),
    readFile(new URL("app/api/app/sectors/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/api/app/services/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/api/app/desks/[id]/route.ts", root), "utf8"),
    readFile(new URL("db/organization-settings.ts", root), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE `sectors`/);
  assert.match(migration, /CREATE TABLE `sector_services`/);
  assert.match(migration, /Atendimento Geral/);
  assert.match(historyMigration, /ADD `sector` text/);
  assert.match(historyMigration, /UPDATE `tickets`/);
  assert.match(schema, /sectorId: integer\("sector_id"\)/);
  assert.match(queue, /SELECT service_id FROM sector_services WHERE sector_id = \?/);
  assert.match(queue, /sector_id = \?/);
  assert.match(management, /Serviços deste setor/);
  assert.match(management, /name="sectorId"/);
  assert.match(management, /Esta ação não poderá ser desfeita/);
  assert.match(sectorsRoute, /authorizeOrganization\(request\)/);
  assert.match(sectorsRoute, /export async function DELETE/);
  assert.match(servicesRoute, /export async function DELETE/);
  assert.match(desksRoute, /export async function DELETE/);
  assert.match(settings, /UPDATE tickets SET service_id = NULL/);
  assert.match(settings, /status NOT IN \('waiting', 'called'\)/);
  assert.match(settings, /UPDATE tickets SET desk_id = NULL/);
  assert.match(settings, /UPDATE tickets SET sector_id = NULL/);
});

test("protege contas com JWT, hash de senha e sessão persistente revogável", async () => {
  const [
    auth,
    login,
    platformDb,
    platformRoute,
    privateTickets,
    developmentSeed,
    refreshRoute,
    sessionKeeper,
  ] = await Promise.all([
    readFile(new URL("db/auth.ts", root), "utf8"),
    readFile(new URL("db/login.ts", root), "utf8"),
    readFile(new URL("db/platform.ts", root), "utf8"),
    readFile(new URL("app/api/platform/organizations/route.ts", root), "utf8"),
    readFile(new URL("app/api/tickets/route.ts", root), "utf8"),
    readFile(new URL("db/seeds/development-admin.sql", root), "utf8"),
    readFile(new URL("app/api/auth/refresh/route.ts", root), "utf8"),
    readFile(new URL("app/session-keeper.tsx", root), "utf8"),
  ]);

  assert.match(auth, /new SignJWT/);
  assert.match(auth, /jwtVerify/);
  assert.match(auth, /PBKDF2_ITERATIONS = 100_000/);
  assert.match(auth, /iterations !== PBKDF2_ITERATIONS/);
  assert.match(auth, /password\.length < 6/);
  assert.match(auth, /HttpOnly; SameSite=Strict/);
  assert.match(auth, /sessions\.revoked_at IS NULL/);
  assert.match(auth, /SESSION_COOKIE_SECONDS = 60 \* 60 \* 24 \* 400/);
  assert.match(auth, /SESSION_EXPIRES_AT = "9999-12-31 23:59:59"/);
  assert.doesNotMatch(auth, /setExpirationTime|sessions\.expires_at > CURRENT_TIMESTAMP/);
  assert.doesNotMatch(login, /expires_at > CURRENT_TIMESTAMP/);
  assert.doesNotMatch(platformDb, /expires_at > CURRENT_TIMESTAMP/);
  assert.match(refreshRoute, /refreshSessionCookie/);
  assert.match(sessionKeeper, /setInterval\(refresh, REFRESH_INTERVAL_MS\)/);
  assert.match(login, /failed_login_attempts/);
  assert.match(platformRoute, /authorizePlatformAdmin\(request\)/);
  assert.match(privateTickets, /authorizeOrganization\(request\)/);
  assert.doesNotMatch(auth, /ChatGPT|oai-authenticated/);
  assert.match(developmentSeed, /velyondev@gmail\.com/);
  assert.match(developmentSeed, /platform_admin/);
  assert.match(developmentSeed, /pbkdf2_sha256\$100000\$/);
  assert.match(developmentSeed, /ON CONFLICT\(email\) DO NOTHING/);
});

test("mantém a hidratação determinística", async () => {
  const queueApp = await readFile(new URL("app/queue-app.tsx", root), "utf8");
  assert.match(queueApp, /useState<Date \| null>\(null\)/);
  assert.match(queueApp, /const updateClock = \(\) => setNow\(new Date\(\)\)/);
  assert.doesNotMatch(queueApp, /useState\(new Date\(\)\)/);
});

test("formata a ficha para bobina térmica de 80 mm", async () => {
  const [queueApp, styles] = await Promise.all([
    readFile(new URL("app/queue-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(queueApp, /formatTicketDate/);
  assert.match(queueApp, /ticket-print-date/);
  assert.match(queueApp, /initialMode !== "client" \|\| !createdTicket/);
  assert.match(queueApp, /requestAnimationFrame/);
  assert.match(queueApp, /window\.print\(\)/);
  assert.match(queueApp, /afterprint/);
  assert.match(queueApp, /setCreatedTicket\(null\)/);
  assert.doesNotMatch(queueApp, /Imprimir comprovante|role="dialog"/);
  assert.doesNotMatch(queueApp, /Tempo estimado|Tempo médio|Previsão/);
  assert.doesNotMatch(queueApp, /client-footer|Sem pessoas aguardando/);
  assert.match(styles, /@page\s*{[\s\S]*size: 80mm 90mm/);
  assert.match(styles, /\.app-shell > \*:not\(\.ticket-print-layer\)/);
  assert.match(styles, /\.ticket-paper[\s\S]*width: 80mm/);
});

test("deriva uma paleta acessível da cor primária da organização", async () => {
  const [theme, queueApp, styles] = await Promise.all([
    readFile(new URL("app/brand-theme.ts", root), "utf8"),
    readFile(new URL("app/queue-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(theme, /readableText/);
  assert.match(theme, /--brand-on-primary/);
  assert.match(theme, /--brand-strong/);
  assert.match(queueApp, /brandThemeStyle\(queue\.organization\.primaryColor\)/);
  assert.match(styles, /linear-gradient\(135deg, var\(--brand-strong\)/);
  assert.match(styles, /\.brand-preview/);
  assert.match(styles, /\.desk-select select[\s\S]*var\(--brand-primary\)/);
  assert.doesNotMatch(styles, /#204b47/i);
});

test("gera o artefato de produção", async () => {
  await access(new URL("dist/server/index.js", root));
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});

test("configura os recursos de produção da Cloudflare", async () => {
  const [wrangler, viteConfig, packageJson] = await Promise.all([
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("vite.config.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(wrangler, /"name": "sistema-chamados"/);
  assert.match(wrangler, /"binding": "DB"/);
  assert.match(wrangler, /e1df1007-d0f7-4919-80cc-4dbb56a72e82/);
  assert.match(wrangler, /"binding": "R2"/);
  assert.match(wrangler, /"bucket_name": "sistema-chamados-logos-prod"/);
  assert.match(wrangler, /"binding": "IMAGES"/);
  assert.match(wrangler, /"migrations_dir": "drizzle"/);
  assert.match(viteConfig, /configPath: "\.\/wrangler\.jsonc"/);
  assert.match(packageJson, /"db:migrate:remote"/);
  assert.match(packageJson, /"deploy:cloudflare"/);
  assert.match(packageJson, /"packageManager": "npm@10\.9\.2"/);
  await assert.rejects(access(new URL("pnpm-lock.yaml", root)));
  await assert.rejects(access(new URL("pnpm-workspace.yaml", root)));
});
