import { ensureQueueSchema, getD1, getDeskCount } from "../../../db/runtime";

export async function GET() {
  try {
    await ensureQueueSchema();
    return Response.json({ deskCount: await getDeskCount() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar a configuração." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureQueueSchema();
    const payload = (await request.json()) as { deskCount?: number };
    const deskCount = Number(payload.deskCount);

    if (!Number.isInteger(deskCount) || deskCount < 1 || deskCount > 50) {
      return Response.json(
        { error: "A quantidade deve estar entre 1 e 50 guichês." },
        { status: 400 }
      );
    }

    const database = getD1();
    const activeAboveLimit = await database
      .prepare(
        `SELECT GROUP_CONCAT(DISTINCT desk) AS desks
         FROM tickets
         WHERE status = 'called' AND desk > ?`
      )
      .bind(deskCount)
      .first<{ desks: string | null }>();

    if (activeAboveLimit?.desks) {
      return Response.json(
        {
          error: `Finalize os atendimentos ativos nos guichês ${activeAboveLimit.desks} antes de reduzir a quantidade.`,
        },
        { status: 409 }
      );
    }

    await database
      .prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ('desk_count', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(String(deskCount))
      .run();

    return Response.json({ deskCount });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar a configuração." },
      { status: 500 }
    );
  }
}
