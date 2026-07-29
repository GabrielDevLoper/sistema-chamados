import { assertSameOrigin, AuthenticationError } from "../../../../../db/auth";
import { updateService } from "../../../../../db/organization-settings";
import { databaseErrorMessage } from "../../../../../db/runtime";
import { authorizeOrganization } from "../../../../organization-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    const { id } = await context.params;
    const serviceId = Number(id);
    if (!Number.isInteger(serviceId)) throw new Error("Serviço inválido.");
    await updateService(organization.id, serviceId, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    const message = databaseErrorMessage(error);
    return Response.json({ error: message.includes("UNIQUE constraint") ? "Já existe um serviço com esse nome." : message }, { status: 400 });
  }
}
