import { getD1 } from "./runtime";
import { listDesks, listSectors, listServices } from "./queue";

const SERVICE_PREFIX = /^[A-Z0-9]{1,3}$/;
const HEX_COLOR = /^#[0-9A-F]{6}$/;

export async function getOrganizationConfiguration(organizationId: number) {
  const [services, sectors, desks] = await Promise.all([
    listServices(organizationId, { includeInactive: true }),
    listSectors(organizationId, { includeInactive: true }),
    listDesks(organizationId, { includeInactive: true }),
  ]);
  return { services, sectors, desks };
}

function normalizedServiceIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

async function assertOrganizationServices(
  organizationId: number,
  serviceIds: number[]
) {
  if (!serviceIds.length) throw new Error("Selecione ao menos um serviço para o setor.");
  const placeholders = serviceIds.map(() => "?").join(", ");
  const result = await getD1()
    .prepare(
      `SELECT COUNT(*) AS total FROM services
       WHERE organization_id = ? AND id IN (${placeholders})`
    )
    .bind(organizationId, ...serviceIds)
    .first<{ total: number }>();
  if (Number(result?.total) !== serviceIds.length) {
    throw new Error("Um dos serviços selecionados não pertence a esta organização.");
  }
}

async function requireActiveSector(organizationId: number, sectorId: number) {
  if (!Number.isInteger(sectorId)) throw new Error("Selecione um setor válido.");
  const sector = await getD1()
    .prepare(
      `SELECT id FROM sectors
       WHERE id = ? AND organization_id = ? AND active = 1 LIMIT 1`
    )
    .bind(sectorId, organizationId)
    .first<{ id: number }>();
  if (!sector) throw new Error("Selecione um setor ativo e válido.");
  return sector;
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
  const database = getD1();
  const service = await database
    .prepare(
      `INSERT INTO services (organization_id, name, ticket_prefix, sort_order)
       VALUES (?, ?, ?, ?) RETURNING id, name, ticket_prefix, active, sort_order`
    )
    .bind(organizationId, name, ticketPrefix, order?.next_order ?? 1)
    .first<{ id: number }>();
  if (!service) throw new Error("Não foi possível criar o serviço.");
  const sector = await database
    .prepare(
      `SELECT id FROM sectors
       WHERE organization_id = ? AND active = 1
       ORDER BY sort_order ASC, id ASC LIMIT 1`
    )
    .bind(organizationId)
    .first<{ id: number }>();
  if (!sector) {
    await database.prepare("DELETE FROM services WHERE id = ?").bind(service.id).run();
    throw new Error("Cadastre um setor ativo antes de criar serviços.");
  }
  await database
    .prepare("INSERT INTO sector_services (sector_id, service_id) VALUES (?, ?)")
    .bind(sector.id, service.id)
    .run();
  return service;
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
  if (input.active !== false) {
    const sector = await getD1()
      .prepare(
        `SELECT sector_services.sector_id
         FROM sector_services
         INNER JOIN sectors ON sectors.id = sector_services.sector_id
         WHERE sector_services.service_id = ?
           AND sectors.organization_id = ? AND sectors.active = 1 LIMIT 1`
      )
      .bind(serviceId, organizationId)
      .first();
    if (!sector) throw new Error("Vincule o serviço a um setor ativo antes de ativá-lo.");
  }
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

export async function createSector(
  organizationId: number,
  input: { name?: unknown; description?: unknown; serviceIds?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();
  const serviceIds = normalizedServiceIds(input.serviceIds);
  if (name.length < 2 || name.length > 80) throw new Error("Informe um nome de setor válido.");
  if (description.length > 180) throw new Error("A descrição deve ter no máximo 180 caracteres.");
  await assertOrganizationServices(organizationId, serviceIds);
  const database = getD1();
  const order = await database
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM sectors WHERE organization_id = ?")
    .bind(organizationId)
    .first<{ next_order: number }>();
  const sector = await database
    .prepare(
      `INSERT INTO sectors (organization_id, name, description, sort_order)
       VALUES (?, ?, ?, ?) RETURNING id`
    )
    .bind(organizationId, name, description, order?.next_order ?? 1)
    .first<{ id: number }>();
  if (!sector) throw new Error("Não foi possível criar o setor.");
  try {
    await database.batch(
      serviceIds.map((serviceId) =>
        database
          .prepare("INSERT INTO sector_services (sector_id, service_id) VALUES (?, ?)")
          .bind(sector.id, serviceId)
      )
    );
  } catch (error) {
    await database.prepare("DELETE FROM sectors WHERE id = ?").bind(sector.id).run();
    throw error;
  }
}

export async function updateSector(
  organizationId: number,
  sectorId: number,
  input: {
    name?: unknown;
    description?: unknown;
    serviceIds?: unknown;
    active?: unknown;
  }
) {
  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();
  const active = input.active !== false;
  const serviceIds = normalizedServiceIds(input.serviceIds);
  if (name.length < 2 || name.length > 80) throw new Error("Informe um nome de setor válido.");
  if (description.length > 180) throw new Error("A descrição deve ter no máximo 180 caracteres.");
  if (active) await assertOrganizationServices(organizationId, serviceIds);
  const database = getD1();
  const existing = await database
    .prepare("SELECT id FROM sectors WHERE id = ? AND organization_id = ? LIMIT 1")
    .bind(sectorId, organizationId)
    .first<{ id: number }>();
  if (!existing) throw new Error("Setor não encontrado.");

  if (!active) {
    const activeDesk = await database
      .prepare(
        `SELECT id FROM desks
         WHERE organization_id = ? AND sector_id = ? AND active = 1 LIMIT 1`
      )
      .bind(organizationId, sectorId)
      .first();
    if (activeDesk) throw new Error("Mova ou desative os guichês deste setor antes de desativá-lo.");
  }

  const currentLinks = await database
    .prepare("SELECT service_id FROM sector_services WHERE sector_id = ?")
    .bind(sectorId)
    .all<{ service_id: number }>();
  const removedIds = currentLinks.results
    .map((row) => row.service_id)
    .filter((serviceId) => !active || !serviceIds.includes(serviceId));
  for (const serviceId of removedIds) {
    const uncoveredActiveService = await database
      .prepare(
        `SELECT services.id
         FROM services
         WHERE services.id = ? AND services.organization_id = ?
           AND services.active = 1
           AND NOT EXISTS (
             SELECT 1 FROM sector_services
             INNER JOIN sectors ON sectors.id = sector_services.sector_id
             WHERE sector_services.service_id = services.id
               AND sectors.organization_id = services.organization_id
               AND sectors.active = 1 AND sectors.id <> ?
           )
         LIMIT 1`
      )
      .bind(serviceId, organizationId, sectorId)
      .first();
    if (uncoveredActiveService) {
      throw new Error("Um serviço ativo não pode ficar sem um setor de atendimento.");
    }
    const stranded = await database
      .prepare(
        `SELECT tickets.id
         FROM tickets
         WHERE tickets.organization_id = ? AND tickets.status = 'waiting'
           AND tickets.service_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM sector_services
             INNER JOIN sectors ON sectors.id = sector_services.sector_id
             WHERE sector_services.service_id = tickets.service_id
               AND sectors.organization_id = tickets.organization_id
               AND sectors.active = 1 AND sectors.id <> ?
           )
         LIMIT 1`
      )
      .bind(organizationId, serviceId, sectorId)
      .first();
    if (stranded) {
      throw new Error("Existem senhas aguardando que ficariam sem um setor de atendimento.");
    }
  }

  await database.batch([
    database
      .prepare(
        `UPDATE sectors SET name = ?, description = ?, active = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`
      )
      .bind(name, description, active ? 1 : 0, sectorId, organizationId),
    database.prepare("DELETE FROM sector_services WHERE sector_id = ?").bind(sectorId),
    ...serviceIds.map((serviceId) =>
      database
        .prepare("INSERT INTO sector_services (sector_id, service_id) VALUES (?, ?)")
        .bind(sectorId, serviceId)
    ),
  ]);
}

export async function createDesk(
  organizationId: number,
  input: { name?: unknown; number?: unknown; sectorId?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const number = Number(input.number);
  const sectorId = Number(input.sectorId);
  if (name.length < 2 || name.length > 60) throw new Error("Informe um nome de guichê válido.");
  if (!Number.isInteger(number) || number < 1 || number > 999) throw new Error("Informe um número de guichê válido.");
  await requireActiveSector(organizationId, sectorId);
  await getD1()
    .prepare("INSERT INTO desks (organization_id, sector_id, name, number) VALUES (?, ?, ?, ?)")
    .bind(organizationId, sectorId, name, number)
    .run();
}

export async function updateDesk(
  organizationId: number,
  deskId: number,
  input: { name?: unknown; number?: unknown; sectorId?: unknown; active?: unknown }
) {
  const name = String(input.name ?? "").trim();
  const number = Number(input.number);
  const sectorId = Number(input.sectorId);
  const active = input.active !== false;
  if (name.length < 2 || name.length > 60) throw new Error("Informe um nome de guichê válido.");
  if (!Number.isInteger(number) || number < 1 || number > 999) throw new Error("Informe um número de guichê válido.");
  await requireActiveSector(organizationId, sectorId);
  const existing = await getD1()
    .prepare("SELECT sector_id FROM desks WHERE id = ? AND organization_id = ? LIMIT 1")
    .bind(deskId, organizationId)
    .first<{ sector_id: number }>();
  if (!existing) throw new Error("Guichê não encontrado.");
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
  if (existing.sector_id !== sectorId) {
    const current = await getD1()
      .prepare(
        `SELECT id FROM tickets
         WHERE organization_id = ? AND desk_id = ? AND status = 'called' LIMIT 1`
      )
      .bind(organizationId, deskId)
      .first();
    if (current) throw new Error("Finalize o atendimento antes de mudar o setor do guichê.");
  }
  const result = await getD1()
    .prepare(
      `UPDATE desks SET name = ?, number = ?, sector_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? RETURNING id`
    )
    .bind(name, number, sectorId, active ? 1 : 0, deskId, organizationId)
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
