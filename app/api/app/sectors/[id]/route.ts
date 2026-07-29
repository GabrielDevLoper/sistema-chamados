import { assertSameOrigin, AuthenticationError } from "../../../../../db/auth";
import { updateSector } from "../../../../../db/organization-settings";
import { databaseErrorMessage } from "../../../../../db/runtime";
import { authorizeOrganization } from "../../../../organization-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    const { id } = await context.params;
    const sectorId = Number(id);
    if (!Number.isInteger(sectorId)) throw new Error("Setor inválido.");
    await updateSector(organization.id, sectorId, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = databaseErrorMessage(error);
    return Response.json(
      {
        error: message.includes("UNIQUE constraint")
          ? "Já existe um setor com esse nome."
          : message,
      },
      { status: message.includes("UNIQUE constraint") ? 409 : 400 }
    );
  }
}
