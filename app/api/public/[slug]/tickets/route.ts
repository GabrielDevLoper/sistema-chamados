import { getOrganizationBySlug } from "../../../../../db/organizations";
import { createTicket, getQueue } from "../../../../../db/queue";
import { databaseErrorMessage } from "../../../../../db/runtime";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const organization = await getOrganizationBySlug(slug);
    if (!organization) {
      return Response.json(
        { error: "Organização não encontrada." },
        { status: 404 }
      );
    }
    return Response.json(await getQueue(organization));
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const organization = await getOrganizationBySlug(slug);
    if (!organization) {
      return Response.json(
        { error: "Organização não encontrada." },
        { status: 404 }
      );
    }
    const payload = (await request.json()) as {
      serviceId?: number;
      priority?: boolean;
    };
    const serviceId = Number(payload.serviceId);
    if (!Number.isInteger(serviceId)) {
      return Response.json(
        { error: "Selecione um serviço válido." },
        { status: 400 }
      );
    }
    const ticket = await createTicket({
      organization,
      serviceId,
      priority: Boolean(payload.priority),
    });
    return Response.json({ ticket }, { status: 201 });
  } catch (error) {
    const message = databaseErrorMessage(error);
    return Response.json(
      { error: message },
      { status: message.includes("serviço válido") ? 400 : 500 }
    );
  }
}
