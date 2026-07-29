import { assertSameOrigin, AuthenticationError } from "../../../../db/auth";
import { updateBranding } from "../../../../db/organization-settings";
import { authorizeOrganization } from "../../../organization-auth";

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    await updateBranding(organization.id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status });
  }
}
