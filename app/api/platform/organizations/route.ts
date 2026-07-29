import { authorizePlatformAdmin, AuthorizationError } from "../../../platform-auth";
import {
  createOrganization,
  listOrganizationSummaries,
} from "../../../../db/platform";
import { databaseErrorMessage } from "../../../../db/runtime";
import { assertSameOrigin } from "../../../../db/auth";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = databaseErrorMessage(error);
  const conflict = message.includes("UNIQUE constraint failed");
  return Response.json(
    {
      error: conflict
        ? "Já existe uma organização com esse endereço ou e-mail."
        : message,
    },
    { status: conflict ? 409 : 400 }
  );
}

export async function GET(request: Request) {
  try {
    await authorizePlatformAdmin(request);
    return Response.json({ organizations: await listOrganizationSummaries() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await authorizePlatformAdmin(request);
    const organization = await createOrganization(await request.json(), user.id);
    return Response.json({ organization }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
