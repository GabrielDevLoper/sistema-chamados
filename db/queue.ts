import { getD1 } from "./runtime";
import type {
  Organization,
  QueueDesk,
  QueuePayload,
  QueueService,
  Ticket,
} from "./types";

type TicketRow = {
  id: number;
  organization_id: number;
  service_id: number | null;
  desk_id: number | null;
  code: string;
  service: string;
  priority: number;
  status: Ticket["status"];
  desk: number | null;
  created_at: string;
  called_at: string | null;
  finished_at: string | null;
};

type ServiceRow = {
  id: number;
  name: string;
  ticket_prefix: string;
  active: number;
  sort_order: number;
};

type DeskRow = {
  id: number;
  name: string;
  number: number;
  active: number;
};

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    organizationId: row.organization_id,
    serviceId: row.service_id,
    deskId: row.desk_id,
    code: row.code,
    service: row.service,
    priority: row.priority,
    status: row.status,
    desk: row.desk,
    createdAt: `${row.created_at.replace(" ", "T")}Z`,
    calledAt: row.called_at
      ? `${row.called_at.replace(" ", "T")}Z`
      : null,
    finishedAt: row.finished_at
      ? `${row.finished_at.replace(" ", "T")}Z`
      : null,
  };
}

function mapService(row: ServiceRow): QueueService {
  return {
    id: row.id,
    name: row.name,
    ticketPrefix: row.ticket_prefix,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
  };
}

function mapDesk(row: DeskRow): QueueDesk {
  return {
    id: row.id,
    name: row.name,
    number: row.number,
    active: Boolean(row.active),
  };
}

export function serviceDateForTimezone(
  timezone: string,
  date = new Date()
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function listServices(
  organizationId: number,
  options: { includeInactive?: boolean } = {}
): Promise<QueueService[]> {
  const { results } = await getD1()
    .prepare(
      `SELECT id, name, ticket_prefix, active, sort_order
       FROM services
       WHERE organization_id = ? ${options.includeInactive ? "" : "AND active = 1"}
       ORDER BY sort_order ASC, name ASC`
    )
    .bind(organizationId)
    .all<ServiceRow>();
  return results.map(mapService);
}

export async function listDesks(
  organizationId: number,
  options: { includeInactive?: boolean } = {}
): Promise<QueueDesk[]> {
  const { results } = await getD1()
    .prepare(
      `SELECT id, name, number, active
       FROM desks
       WHERE organization_id = ? ${options.includeInactive ? "" : "AND active = 1"}
       ORDER BY number ASC`
    )
    .bind(organizationId)
    .all<DeskRow>();
  return results.map(mapDesk);
}

export async function getQueue(
  organization: Organization
): Promise<QueuePayload> {
  const database = getD1();
  const serviceDate = serviceDateForTimezone(organization.timezone);
  const [ticketResult, stats, services, desks] = await Promise.all([
    database
      .prepare(
        `SELECT * FROM tickets
         WHERE organization_id = ? AND service_date = ?
         ORDER BY
           CASE status WHEN 'called' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,
           CASE WHEN status = 'waiting' THEN priority ELSE 0 END DESC,
           created_at ASC,
           id ASC`
      )
      .bind(organization.id, serviceDate)
      .all<TicketRow>(),
    database
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
          SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS served,
          AVG(CASE
            WHEN status = 'finished' AND called_at IS NOT NULL
            THEN (julianday(finished_at) - julianday(called_at)) * 1440
          END) AS average_minutes
         FROM tickets
         WHERE organization_id = ? AND service_date = ?`
      )
      .bind(organization.id, serviceDate)
      .first<{
        waiting: number | null;
        served: number | null;
        average_minutes: number | null;
      }>(),
    listServices(organization.id),
    listDesks(organization.id),
  ]);

  return {
    organization: {
      tradeName: organization.tradeName,
      slug: organization.slug,
      logoKey: organization.logoKey,
      primaryColor: organization.primaryColor,
      timezone: organization.timezone,
    },
    services,
    desks,
    tickets: ticketResult.results.map(mapTicket),
    waiting: stats?.waiting ?? 0,
    served: stats?.served ?? 0,
    averageMinutes: Math.max(0, Math.round(stats?.average_minutes ?? 0)),
  };
}

export async function createTicket(input: {
  organization: Organization;
  serviceId: number;
  priority: boolean;
}): Promise<Ticket> {
  const database = getD1();
  const service = await database
    .prepare(
      `SELECT id, name, ticket_prefix, active, sort_order
       FROM services
       WHERE id = ? AND organization_id = ? AND active = 1
       LIMIT 1`
    )
    .bind(input.serviceId, input.organization.id)
    .first<ServiceRow>();
  if (!service) throw new Error("Selecione um serviço válido.");

  const serviceDate = serviceDateForTimezone(input.organization.timezone);
  const sequence = await database
    .prepare(
      `INSERT INTO ticket_sequences (
        organization_id,
        service_date,
        last_number,
        updated_at
      ) VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(organization_id, service_date) DO UPDATE SET
        last_number = last_number + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING last_number`
    )
    .bind(input.organization.id, serviceDate)
    .first<{ last_number: number }>();
  if (!sequence) throw new Error("Não foi possível gerar a próxima senha.");

  const prefix = input.priority ? "P" : service.ticket_prefix.toUpperCase();
  const code = `${prefix}${sequence.last_number.toString().padStart(3, "0")}`;
  const ticket = await database
    .prepare(
      `INSERT INTO tickets (
        organization_id,
        service_id,
        service_date,
        sequence_number,
        code,
        service,
        priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *`
    )
    .bind(
      input.organization.id,
      service.id,
      serviceDate,
      sequence.last_number,
      code,
      service.name,
      input.priority ? 1 : 0
    )
    .first<TicketRow>();
  if (!ticket) throw new Error("Não foi possível criar a senha.");
  return mapTicket(ticket);
}

export async function callNextTicket(input: {
  organization: Organization;
  deskId: number;
}): Promise<Ticket> {
  const database = getD1();
  const serviceDate = serviceDateForTimezone(input.organization.timezone);
  const desk = await database
    .prepare(
      `SELECT id, name, number, active
       FROM desks
       WHERE id = ? AND organization_id = ? AND active = 1
       LIMIT 1`
    )
    .bind(input.deskId, input.organization.id)
    .first<DeskRow>();
  if (!desk) throw new Error("Guichê inválido.");

  const current = await database
    .prepare(
      `SELECT * FROM tickets
       WHERE organization_id = ? AND service_date = ?
         AND status = 'called' AND desk_id = ?
       LIMIT 1`
    )
    .bind(input.organization.id, serviceDate, desk.id)
    .first<TicketRow>();
  if (current) return mapTicket(current);

  const called = await database
    .prepare(
      `UPDATE tickets
       SET
         status = 'called',
         desk_id = ?,
         desk = ?,
         called_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM tickets
         WHERE organization_id = ? AND service_date = ? AND status = 'waiting'
         ORDER BY priority DESC, created_at ASC, id ASC
         LIMIT 1
       ) AND organization_id = ? AND status = 'waiting'
       RETURNING *`
    )
    .bind(
      desk.id,
      desk.number,
      input.organization.id,
      serviceDate,
      input.organization.id
    )
    .first<TicketRow>();
  if (!called) throw new Error("Não há senhas aguardando.");
  return mapTicket(called);
}

export async function updateTicketStatus(input: {
  organizationId: number;
  ticketId: number;
  action: "finish" | "no_show" | "recall";
}): Promise<Ticket> {
  const database = getD1();
  const sql =
    input.action === "finish"
      ? `UPDATE tickets SET status = 'finished', finished_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND status = 'called' RETURNING *`
      : input.action === "no_show"
        ? `UPDATE tickets SET status = 'no_show', finished_at = CURRENT_TIMESTAMP
           WHERE id = ? AND organization_id = ? AND status = 'called' RETURNING *`
        : `UPDATE tickets SET called_at = CURRENT_TIMESTAMP
           WHERE id = ? AND organization_id = ? AND status = 'called' RETURNING *`;
  const ticket = await database
    .prepare(sql)
    .bind(input.ticketId, input.organizationId)
    .first<TicketRow>();
  if (!ticket) throw new Error("Esta senha já foi atualizada.");
  return mapTicket(ticket);
}
