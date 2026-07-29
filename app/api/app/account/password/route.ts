import {
  assertSameOrigin,
  AuthenticationError,
  clearSessionCookies,
} from "../../../../../db/auth";
import { changePassword } from "../../../../../db/login";
import { authorizeOrganization } from "../../../../organization-auth";

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { user } = await authorizeOrganization(request);
    const payload = (await request.json()) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    await changePassword(
      user.id,
      String(payload.currentPassword ?? ""),
      String(payload.newPassword ?? "")
    );
    const response = Response.json({ ok: true });
    for (const cookie of clearSessionCookies(request)) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível alterar." }, { status });
  }
}
