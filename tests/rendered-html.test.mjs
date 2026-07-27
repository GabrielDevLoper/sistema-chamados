import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("entrega as quatro telas do sistema", async () => {
  const [clientPage, attendantPage, displayPage, adminPage, queueApp] = await Promise.all([
    readFile(new URL("app/cliente/page.tsx", root), "utf8"),
    readFile(new URL("app/atendente/page.tsx", root), "utf8"),
    readFile(new URL("app/painel/page.tsx", root), "utf8"),
    readFile(new URL("app/administrador/page.tsx", root), "utf8"),
    readFile(new URL("app/queue-app.tsx", root), "utf8"),
  ]);

  assert.match(clientPage, /initialMode="client"/);
  assert.match(attendantPage, /initialMode="attendant"/);
  assert.match(displayPage, /initialMode="display"/);
  assert.match(adminPage, /initialMode="admin"/);
  assert.match(queueApp, /Como podemos ajudar\?/);
  assert.match(queueApp, /Atendimento prioritário/);
  assert.match(queueApp, /Próximos da fila/);
  assert.match(queueApp, /Chamar próxima senha/);
  assert.match(queueApp, /Chamada atual/);
  assert.match(queueApp, /Ativar som/);
  assert.match(queueApp, /Quantidade de guichês/);
  assert.match(queueApp, /deskOptions/);
});

test("mantém fila persistente e remove o conteúdo temporário", async () => {
  const [route, settingsRoute, runtime, hosting, packageJson] = await Promise.all([
    readFile(new URL("app/api/tickets/route.ts", root), "utf8"),
    readFile(new URL("app/api/settings/route.ts", root), "utf8"),
    readFile(new URL("db/runtime.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(runtime, /CREATE TABLE IF NOT EXISTS tickets/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS settings/);
  assert.match(route, /call_next/);
  assert.match(settingsRoute, /deskCount/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
  await access(new URL("dist/server/index.js", root));
});
