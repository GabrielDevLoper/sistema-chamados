import { assertSameOrigin, AuthenticationError } from "../../../../db/auth";
import {
  createSector,
  getOrganizationConfiguration,
} from "../../../../db/organization-settings";
import { databaseErrorMessage } from "../../../../db/runtime";
import { authorizeOrganization } from "../../../organization-auth";

function failure(error: unknown) {
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

export async function GET(request: Request) {
  try {
    const { organization } = await authorizeOrganization(request);
    return Response.json(await getOrganizationConfiguration(organization.id));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    await createSector(organization.id, await request.json());
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
