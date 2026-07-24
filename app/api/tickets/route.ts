import { env } from "cloudflare:workers";

type TicketRow = {
  id: number;
  code: string;
  service: string;
  priority: number;
  status: string;
  desk: number | null;
  created_at: string;
  called_at: string | null;
  finished_at: string | null;
};

function db() {
  if (!env.DB) {
    throw new Error("A fila ainda não está conectada ao banco de dados.");
  }
  return env.DB;
}

async function ensureSchema() {
  const database = db();
  await database.batch([
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          service TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'waiting',
          desk INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          called_at TEXT,
          finished_at TEXT
        )`
      ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS tickets_queue_idx ON tickets(status, priority, created_at)"
    ),
  ]);
}

function mapTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    code: ticket.code,
    service: ticket.service,
    priority: ticket.priority,
    status: ticket.status,
    desk: ticket.desk,
    createdAt: `${ticket.created_at.replace(" ", "T")}Z`,
    calledAt: ticket.called_at
      ? `${ticket.called_at.replace(" ", "T")}Z`
      : null,
    finishedAt: ticket.finished_at
      ? `${ticket.finished_at.replace(" ", "T")}Z`
      : null,
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const database = db();
    const { results } = await database
      .prepare(
        `SELECT * FROM tickets
         WHERE date(created_at, '-3 hours') = date('now', '-3 hours')
         ORDER BY
           CASE status WHEN 'called' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,
           CASE WHEN status = 'waiting' THEN priority ELSE 0 END DESC,
           created_at ASC`
      )
      .all<TicketRow>();

    const stats = await database
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
          SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS served,
          AVG(CASE
            WHEN status = 'finished' AND called_at IS NOT NULL
            THEN (julianday(finished_at) - julianday(called_at)) * 1440
          END) AS average_minutes
         FROM tickets
         WHERE date(created_at, '-3 hours') = date('now', '-3 hours')`
      )
      .first<{ waiting: number | null; served: number | null; average_minutes: number | null }>();

    return Response.json({
      tickets: results.map(mapTicket),
      waiting: stats?.waiting ?? 0,
      served: stats?.served ?? 0,
      averageMinutes: Math.max(0, Math.round(stats?.average_minutes ?? 0)),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar a fila." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const database = db();
    const payload = (await request.json()) as {
      action?: string;
      service?: string;
      priority?: boolean;
      desk?: number;
      id?: number;
    };

    if (payload.action === "create") {
      const allowedServices = [
        "Atendimento geral",
        "Certidões",
        "Registro e reconhecimento",
      ];
      if (!payload.service || !allowedServices.includes(payload.service)) {
        return Response.json({ error: "Selecione um serviço válido." }, { status: 400 });
      }

      const count = await database
        .prepare(
          `SELECT COUNT(*) AS total FROM tickets
           WHERE date(created_at, '-3 hours') = date('now', '-3 hours')`
        )
        .first<{ total: number }>();
      const sequence = (count?.total ?? 0) + 1;
      const prefix = payload.priority
        ? "P"
        : payload.service === "Certidões"
          ? "C"
          : payload.service === "Registro e reconhecimento"
            ? "R"
            : "A";
      const code = `${prefix}${sequence.toString().padStart(3, "0")}`;

      const created = await database
        .prepare(
          `INSERT INTO tickets (code, service, priority)
           VALUES (?, ?, ?)
           RETURNING *`
        )
        .bind(code, payload.service, payload.priority ? 1 : 0)
        .first<TicketRow>();

      return Response.json({ ticket: created ? mapTicket(created) : null }, { status: 201 });
    }

    if (payload.action === "call_next") {
      const desk = Number(payload.desk);
      if (!Number.isInteger(desk) || desk < 1 || desk > 99) {
        return Response.json({ error: "Guichê inválido." }, { status: 400 });
      }

      const alreadyOpen = await database
        .prepare("SELECT * FROM tickets WHERE status = 'called' AND desk = ? LIMIT 1")
        .bind(desk)
        .first<TicketRow>();
      if (alreadyOpen) {
        return Response.json({ ticket: mapTicket(alreadyOpen) });
      }

      const next = await database
        .prepare(
          `SELECT * FROM tickets
           WHERE status = 'waiting'
           ORDER BY priority DESC, created_at ASC, id ASC
           LIMIT 1`
        )
        .first<TicketRow>();
      if (!next) {
        return Response.json({ error: "Não há senhas aguardando." }, { status: 409 });
      }

      const called = await database
        .prepare(
          `UPDATE tickets
           SET status = 'called', desk = ?, called_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'waiting'
           RETURNING *`
        )
        .bind(desk, next.id)
        .first<TicketRow>();

      if (!called) {
        return Response.json(
          { error: "A fila mudou. Tente chamar novamente." },
          { status: 409 }
        );
      }
      return Response.json({ ticket: mapTicket(called) });
    }

    if (["finish", "no_show", "recall"].includes(payload.action ?? "")) {
      const id = Number(payload.id);
      if (!Number.isInteger(id)) {
        return Response.json({ error: "Senha inválida." }, { status: 400 });
      }

      const sql =
        payload.action === "finish"
          ? "UPDATE tickets SET status = 'finished', finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'called' RETURNING *"
          : payload.action === "no_show"
            ? "UPDATE tickets SET status = 'no_show', finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'called' RETURNING *"
            : "UPDATE tickets SET called_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'called' RETURNING *";
      const updated = await database.prepare(sql).bind(id).first<TicketRow>();
      if (!updated) {
        return Response.json({ error: "Esta senha já foi atualizada." }, { status: 409 });
      }
      return Response.json({ ticket: mapTicket(updated) });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar a fila." },
      { status: 500 }
    );
  }
}
