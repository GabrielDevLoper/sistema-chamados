import { assertSameOrigin, AuthenticationError, clearSessionCookies } from "../../../../db/auth";
import { getD1 } from "../../../../db/runtime";
import { authorizeOrganization } from "../../../organization-auth";

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { user } = await authorizeOrganization(request);
    await getD1()
      .prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL")
      .bind(user.id)
      .run();
    const response = Response.json({ ok: true });
    for (const cookie of clearSessionCookies(request)) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível encerrar." }, { status });
  }
}
