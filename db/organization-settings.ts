import { getD1 } from "./runtime";
import { listDesks, listServices } from "./queue";

const SERVICE_PREFIX = /^[A-Z0-9]{1,3}$/;
const HEX_COLOR = /^#[0-9A-F]{6}$/;

export async function getOrganizationConfiguration(organizationId: number) {
  const [services, desks] = await Promise.all([
    listServices(organizationId, { includeInactive: true }),
    listDesks(organizationId, { includeInactive: true }),
  ]);
  return { services, desks };
}

export async function createService(
  organizationId: number,
  input: { name?: unknown; ticketPrefix?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const ticketPrefix = String(input.ticketPrefix ?? "").trim().toUpperCase();
  if (name.length < 2 || name.length > 80) throw new Error("Informe um nome de serviço válido.");
  if (!SERVICE_PREFIX.test(ticketPrefix)) throw new Error("O prefixo deve ter de 1 a 3 letras ou números.");
  const order = await getD1()
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM services WHERE organization_id = ?")
    .bind(organizationId)
    .first<{ next_order: number }>();
  return getD1()
    .prepare(
      `INSERT INTO services (organization_id, name, ticket_prefix, sort_order)
       VALUES (?, ?, ?, ?) RETURNING id, name, ticket_prefix, active, sort_order`
    )
    .bind(organizationId, name, ticketPrefix, order?.next_order ?? 1)
    .first();
}

export async function updateService(
  organizationId: number,
  serviceId: number,
  input: { name?: unknown; ticketPrefix?: unknown; active?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const ticketPrefix = String(input.ticketPrefix ?? "").trim().toUpperCase();
  if (name.length < 2 || name.length > 80) throw new Error("Informe um nome de serviço válido.");
  if (!SERVICE_PREFIX.test(ticketPrefix)) throw new Error("O prefixo deve ter de 1 a 3 letras ou números.");
  const result = await getD1()
    .prepare(
      `UPDATE services SET name = ?, ticket_prefix = ?, active = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? RETURNING id`
    )
    .bind(name, ticketPrefix, input.active === false ? 0 : 1, serviceId, organizationId)
    .first<{ id: number }>();
  if (!result) throw new Error("Serviço não encontrado.");
}

export async function createDesk(
  organizationId: number,
  input: { name?: unknown; number?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const number = Number(input.number);
  if (name.length < 2 || name.length > 60) throw new Error("Informe um nome de guichê válido.");
  if (!Number.isInteger(number) || number < 1 || number > 999) throw new Error("Informe um número de guichê válido.");
  await getD1()
    .prepare("INSERT INTO desks (organization_id, name, number) VALUES (?, ?, ?)")
    .bind(organizationId, name, number)
    .run();
}

export async function updateDesk(
  organizationId: number,
  deskId: number,
  input: { name?: unknown; number?: unknown; active?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const number = Number(input.number);
  const active = input.active !== false;
  if (name.length < 2 || name.length > 60) throw new Error("Informe um nome de guichê válido.");
  if (!Number.isInteger(number) || number < 1 || number > 999) throw new Error("Informe um número de guichê válido.");
  if (!active) {
    const current = await getD1()
      .prepare(
        `SELECT id FROM tickets
         WHERE organization_id = ? AND desk_id = ? AND status = 'called' LIMIT 1`
      )
      .bind(organizationId, deskId)
      .first();
    if (current) throw new Error("Finalize o atendimento deste guichê antes de desativá-lo.");
  }
  const result = await getD1()
    .prepare(
      `UPDATE desks SET name = ?, number = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? RETURNING id`
    )
    .bind(name, number, active ? 1 : 0, deskId, organizationId)
    .first<{ id: number }>();
  if (!result) throw new Error("Guichê não encontrado.");
}

export async function updateBranding(
  organizationId: number,
  input: { tradeName?: unknown; primaryColor?: unknown; timezone?: unknown }
) {
  const tradeName = String(input.tradeName ?? "").trim();
  const primaryColor = String(input.primaryColor ?? "").trim().toUpperCase();
  const timezone = String(input.timezone ?? "").trim();
  if (tradeName.length < 2 || tradeName.length > 100) throw new Error("Informe um nome fantasia válido.");
  if (!HEX_COLOR.test(primaryColor)) throw new Error("Informe a cor no formato #RRGGBB.");
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
  } catch {
    throw new Error("Informe um fuso horário válido.");
  }
  await getD1()
    .prepare(
      `UPDATE organizations SET trade_name = ?, primary_color = ?, timezone = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(tradeName, primaryColor, timezone, organizationId)
    .run();
}
