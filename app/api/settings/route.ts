import { assertSameOrigin, AuthenticationError } from "../../../db/auth";
import { authorizeOrganization } from "../../organization-auth";
import { listDesks } from "../../../db/queue";
import { databaseErrorMessage, getD1 } from "../../../db/runtime";

export async function GET(request: Request) {
  try {
    const { organization } = await authorizeOrganization(request);
    const desks = await listDesks(organization.id);
    return Response.json({ deskCount: desks.length, desks });
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

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { organization } = await authorizeOrganization(request);
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
         WHERE organization_id = ? AND status = 'called' AND desk > ?`
      )
      .bind(organization.id, deskCount)
      .first<{ desks: string | null }>();
    if (activeAboveLimit?.desks) {
      return Response.json(
        {
          error: `Finalize os atendimentos ativos nos guichês ${activeAboveLimit.desks} antes de reduzir a quantidade.`,
        },
        { status: 409 }
      );
    }

    const allDesks = await listDesks(organization.id, { includeInactive: true });
    const statements: D1PreparedStatement[] = [];
    for (let number = 1; number <= deskCount; number += 1) {
      const existing = allDesks.find((desk) => desk.number === number);
      if (existing) {
        statements.push(
          database
            .prepare(
              "UPDATE desks SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?"
            )
            .bind(existing.id, organization.id)
        );
      } else {
        statements.push(
          database
            .prepare(
              `INSERT INTO desks (organization_id, name, number)
               VALUES (?, ?, ?)`
            )
            .bind(
              organization.id,
              `Guichê ${number.toString().padStart(2, "0")}`,
              number
            )
        );
      }
    }
    statements.push(
      database
        .prepare(
          `UPDATE desks SET active = 0, updated_at = CURRENT_TIMESTAMP
           WHERE organization_id = ? AND number > ?`
        )
        .bind(organization.id, deskCount)
    );
    await database.batch(statements);
    return Response.json({ deskCount, desks: await listDesks(organization.id) });
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
