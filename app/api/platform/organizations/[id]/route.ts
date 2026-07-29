import { authorizePlatformAdmin, AuthorizationError } from "../../../../platform-auth";
import {
  getOrganizationSummary,
  updateOrganization,
} from "../../../../../db/platform";
import { databaseErrorMessage } from "../../../../../db/runtime";
import { assertSameOrigin } from "../../../../../db/auth";

type RouteContext = { params: Promise<{ id: string }> };

function organizationId(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Organização inválida.");
  return id;
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = databaseErrorMessage(error);
  const missing = message.includes("não encontrada");
  const conflict = message.includes("UNIQUE constraint failed");
  return Response.json(
    {
      error: conflict
        ? "Já existe uma organização com esse endereço ou e-mail."
        : message,
    },
    { status: missing ? 404 : conflict ? 409 : 400 }
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await authorizePlatformAdmin(_request);
    const { id: rawId } = await context.params;
    const organization = await getOrganizationSummary(organizationId(rawId));
    if (!organization) {
      return Response.json({ error: "Organização não encontrada." }, { status: 404 });
    }
    return Response.json({ organization });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await authorizePlatformAdmin(request);
    const { id: rawId } = await context.params;
    const organization = await updateOrganization(
      organizationId(rawId),
      await request.json(),
      user.id
    );
    return Response.json({ organization });
  } catch (error) {
    return errorResponse(error);
  }
}
