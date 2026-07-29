import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  if (!env.DB) {
    throw new Error(
      "O banco de dados não está disponível. Verifique o binding D1 `DB`."
    );
  }
  return env.DB;
}

export function getR2(): R2Bucket {
  const runtime = env as unknown as { R2?: R2Bucket };
  if (!runtime.R2) {
    throw new Error("O armazenamento de logos não está disponível. Verifique o binding R2 `R2`.");
  }
  return runtime.R2;
}

export function databaseErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  if (
    message.includes("no such table") ||
    message.includes("has no column named")
  ) {
    return "O banco precisa receber as migrations mais recentes antes de continuar.";
  }
  return message;
}
