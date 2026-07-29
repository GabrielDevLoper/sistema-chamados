import {
  assertSameOrigin,
  clearSessionCookies,
  revokeCurrentSession,
} from "../../../../db/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await revokeCurrentSession(request);
  } catch {
    // O cookie também é removido quando a sessão já expirou.
  }
  const response = Response.json({ ok: true });
  for (const cookie of clearSessionCookies(request)) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
