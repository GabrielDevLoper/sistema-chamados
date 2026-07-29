import { assertSameOrigin, AuthenticationError } from "../../../../../../db/auth";
import { storeOrganizationLogo } from "../../../../../../db/logos";
import { authorizePlatformAdmin } from "../../../../../platform-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    await authorizePlatformAdmin(request);
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Organização inválida.");
    const form = await request.formData();
    const logo = form.get("logo");
    if (!(logo instanceof File)) throw new Error("Selecione uma logo.");
    await storeOrganizationLogo(id, logo);
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar." }, { status });
  }
}
