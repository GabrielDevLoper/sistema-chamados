import { adminSetupToken, assertSameOrigin } from "../../../../db/auth";
import { createInitialPlatformAdmin } from "../../../../db/login";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const payload = (await request.json()) as {
      setupToken?: unknown;
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };
    const expectedToken = adminSetupToken();
    if (!expectedToken || String(payload.setupToken ?? "") !== expectedToken) {
      return Response.json({ error: "Código de configuração inválido." }, { status: 403 });
    }
    await createInitialPlatformAdmin(payload);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível configurar." },
      { status: 400 }
    );
  }
}
