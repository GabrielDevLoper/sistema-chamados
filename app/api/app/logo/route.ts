import { assertSameOrigin, AuthenticationError } from "../../../../db/auth";
import { storeOrganizationLogo } from "../../../../db/logos";
import { authorizeOrganization } from "../../../organization-auth";

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    const form = await request.formData();
    const logo = form.get("logo");
    if (!(logo instanceof File)) throw new Error("Selecione uma logo.");
    await storeOrganizationLogo(organization.id, logo);
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar." }, { status });
  }
}
