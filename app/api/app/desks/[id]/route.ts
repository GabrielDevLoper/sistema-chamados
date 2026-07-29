import { assertSameOrigin, AuthenticationError } from "../../../../../db/auth";
import { updateDesk } from "../../../../../db/organization-settings";
import { databaseErrorMessage } from "../../../../../db/runtime";
import { authorizeOrganization } from "../../../../organization-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    const { id } = await context.params;
    const deskId = Number(id);
    if (!Number.isInteger(deskId)) throw new Error("Guichê inválido.");
    await updateDesk(organization.id, deskId, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    const message = databaseErrorMessage(error);
    return Response.json({ error: message.includes("UNIQUE constraint") ? "Já existe um guichê com esse número." : message }, { status: 400 });
  }
}
