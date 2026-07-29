import { assertSameOrigin, AuthenticationError } from "../../../db/auth";
import { authorizeOrganization } from "../../organization-auth";
import {
  callNextTicket,
  createTicket,
  getQueue,
  listDesks,
  listServices,
  updateTicketStatus,
} from "../../../db/queue";
import { databaseErrorMessage } from "../../../db/runtime";

export async function GET(request: Request) {
  try {
    const { organization } = await authorizeOrganization(request);
    return Response.json(await getQueue(organization));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
    const payload = (await request.json()) as {
      action?: string;
      serviceId?: number;
      service?: string;
      priority?: boolean;
      deskId?: number;
      desk?: number;
      id?: number;
    };

    if (payload.action === "create") {
      let serviceId = Number(payload.serviceId);
      if (!Number.isInteger(serviceId) && payload.service) {
        const service = (await listServices(organization.id)).find(
          (item) => item.name === payload.service
        );
        serviceId = service?.id ?? Number.NaN;
      }
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
    }

    if (payload.action === "call_next") {
      let deskId = Number(payload.deskId);
      if (!Number.isInteger(deskId) && Number.isInteger(Number(payload.desk))) {
        const desk = (await listDesks(organization.id)).find(
          (item) => item.number === Number(payload.desk)
        );
        deskId = desk?.id ?? Number.NaN;
      }
      if (!Number.isInteger(deskId)) {
        return Response.json({ error: "Guichê inválido." }, { status: 400 });
      }
      const ticket = await callNextTicket({ organization, deskId });
      return Response.json({ ticket });
    }

    if (["finish", "no_show", "recall"].includes(payload.action ?? "")) {
      const ticketId = Number(payload.id);
      if (!Number.isInteger(ticketId)) {
        return Response.json({ error: "Senha inválida." }, { status: 400 });
      }
      const ticket = await updateTicketStatus({
        organizationId: organization.id,
        ticketId,
        action: payload.action as "finish" | "no_show" | "recall",
      });
      return Response.json({ ticket });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = databaseErrorMessage(error);
    const status =
      message.includes("não há senhas") || message.includes("já foi atualizada")
        ? 409
        : message.includes("válido") || message.includes("inválido")
          ? 400
          : 500;
    return Response.json({ error: message }, { status });
  }
}
