import { authenticateRequest, AuthenticationError } from "../../../../db/auth";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    return Response.json({ user });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado." },
      { status }
    );
  }
}
