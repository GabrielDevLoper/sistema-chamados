import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("entrega as duas telas do sistema", async () => {
  const [clientPage, attendantPage, queueApp] = await Promise.all([
    readFile(new URL("app/cliente/page.tsx", root), "utf8"),
    readFile(new URL("app/atendente/page.tsx", root), "utf8"),
    readFile(new URL("app/queue-app.tsx", root), "utf8"),
  ]);

  assert.match(clientPage, /initialMode="client"/);
  assert.match(attendantPage, /initialMode="attendant"/);
  assert.match(queueApp, /Como podemos ajudar\?/);
  assert.match(queueApp, /Atendimento prioritário/);
  assert.match(queueApp, /Próximos da fila/);
  assert.match(queueApp, /Chamar próxima senha/);
});

test("mantém fila persistente e remove o conteúdo temporário", async () => {
  const [route, hosting, packageJson] = await Promise.all([
    readFile(new URL("app/api/tickets/route.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(route, /CREATE TABLE IF NOT EXISTS tickets/);
  assert.match(route, /call_next/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
  await access(new URL("dist/server/index.js", root));
});
