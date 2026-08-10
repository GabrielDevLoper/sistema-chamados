import { getD1 } from "./runtime";
import { serviceDateForTimezone } from "./queue";

export type DailyAttendanceReport = {
  date: string;
  issued: number;
  completed: number;
  noShow: number;
  pending: number;
  priority: number;
};

export type ServiceAttendanceReport = {
  service: string;
  issued: number;
  completed: number;
  noShow: number;
};

export type AttendanceReport = {
  from: string;
  to: string;
  totals: Omit<DailyAttendanceReport, "date">;
  days: DailyAttendanceReport[];
  services: ServiceAttendanceReport[];
};

type DailyRow = {
  service_date: string;
  issued: number;
  completed: number;
  no_show: number;
  pending: number;
  priority: number;
};

type ServiceRow = {
  service: string;
  issued: number;
  completed: number;
  no_show: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function attendanceReportPeriod(
  input: { from?: string | null; to?: string | null },
  timezone: string,
) {
  const today = serviceDateForTimezone(timezone);
  const defaultFrom = `${today.slice(0, 8)}01`;
  const from = input.from?.trim() || defaultFrom;
  const to = input.to?.trim() || today;

  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    throw new Error("Informe um período válido.");
  }
  if (from > to) {
    throw new Error("A data inicial deve ser anterior à data final.");
  }
  if (to > today) {
    throw new Error("A data final não pode estar no futuro.");
  }

  return { from, to };
}

export async function getAttendanceReport(
  organizationId: number,
  period: { from: string; to: string },
): Promise<AttendanceReport> {
  const database = getD1();
  const [dailyResult, serviceResult] = await Promise.all([
    database
      .prepare(
        `SELECT
          service_date,
          COUNT(*) AS issued,
          SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
          SUM(CASE WHEN status IN ('waiting', 'called') THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) AS priority
         FROM tickets
         WHERE organization_id = ?
           AND service_date BETWEEN ? AND ?
         GROUP BY service_date
         ORDER BY service_date DESC`,
      )
      .bind(organizationId, period.from, period.to)
      .all<DailyRow>(),
    database
      .prepare(
        `SELECT
          service,
          COUNT(*) AS issued,
          SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show
         FROM tickets
         WHERE organization_id = ?
           AND service_date BETWEEN ? AND ?
         GROUP BY service
         ORDER BY issued DESC, service ASC`,
      )
      .bind(organizationId, period.from, period.to)
      .all<ServiceRow>(),
  ]);

  const days = dailyResult.results.map((row) => ({
    date: row.service_date,
    issued: row.issued ?? 0,
    completed: row.completed ?? 0,
    noShow: row.no_show ?? 0,
    pending: row.pending ?? 0,
    priority: row.priority ?? 0,
  }));
  const totals = days.reduce(
    (sum, day) => ({
      issued: sum.issued + day.issued,
      completed: sum.completed + day.completed,
      noShow: sum.noShow + day.noShow,
      pending: sum.pending + day.pending,
      priority: sum.priority + day.priority,
    }),
    { issued: 0, completed: 0, noShow: 0, pending: 0, priority: 0 },
  );

  return {
    ...period,
    totals,
    days,
    services: serviceResult.results.map((row) => ({
      service: row.service,
      issued: row.issued ?? 0,
      completed: row.completed ?? 0,
      noShow: row.no_show ?? 0,
    })),
  };
}
