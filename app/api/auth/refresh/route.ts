import {
  assertSameOrigin,
  AuthenticationError,
  clearSessionCookies,
  refreshSessionCookie,
} from "../../../../db/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookie = await refreshSessionCookie(request);
    if (!cookie) {
      return new Response(null, {
        headers: { "cache-control": "no-store" },
        status: 204,
      });
    }
    return Response.json(
      { ok: true },
      {
        headers: {
          "cache-control": "no-store",
          "set-cookie": cookie,
        },
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const response = new Response(null, { status: 204 });
      response.headers.set("cache-control", "no-store");
      for (const cookie of clearSessionCookies(request)) {
        response.headers.append("set-cookie", cookie);
      }
      return response;
    }
    return Response.json(
      { error: "Não foi possível renovar a sessão." },
      { status: 500 },
    );
  }
}
