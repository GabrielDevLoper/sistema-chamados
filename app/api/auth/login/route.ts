import { assertSameOrigin, createSession, sessionCookie } from "../../../../db/auth";
import { verifyCredentials } from "../../../../db/login";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const payload = (await request.json()) as { email?: unknown; password?: unknown };
    const user = await verifyCredentials(
      String(payload.email ?? ""),
      String(payload.password ?? "")
    );
    const session = await createSession(user, request);
    return Response.json(
      {
        user: {
          name: user.name,
          role: user.role,
          redirectTo: user.role === "platform_admin" ? "/plataforma/organizacoes" : "/app",
        },
      },
      { headers: { "set-cookie": sessionCookie(session.token, request) } }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível entrar." },
      { status: 401 }
    );
  }
}
