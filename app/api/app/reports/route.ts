import { AuthenticationError } from "../../../../db/auth";
import {
  attendanceReportPeriod,
  getAttendanceReport,
} from "../../../../db/reports";
import { authorizeOrganization } from "../../../organization-auth";

export async function GET(request: Request) {
  try {
    const { organization } = await authorizeOrganization(request);
    const url = new URL(request.url);
    const period = attendanceReportPeriod(
      {
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      },
      organization.timezone,
    );
    return Response.json(await getAttendanceReport(organization.id, period));
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 400;
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o relatório.",
      },
      { status },
    );
  }
}
