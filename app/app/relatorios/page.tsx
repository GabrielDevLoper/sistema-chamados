import Link from "next/link";
import {
  attendanceReportPeriod,
  getAttendanceReport,
} from "../../../db/reports";
import { brandThemeStyle } from "../../brand-theme";
import { requireOrganizationPage } from "../../organization-auth";

type PageProps = {
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
  }>;
};

function parameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function rate(completed: number, issued: number) {
  return issued ? Math.round((completed / issued) * 100) : 0;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const { organization } = await requireOrganizationPage("/app/relatorios");
  const params = await searchParams;
  let period = attendanceReportPeriod({}, organization.timezone);
  let periodError = "";

  try {
    period = attendanceReportPeriod(
      { from: parameter(params.from), to: parameter(params.to) },
      organization.timezone,
    );
  } catch (error) {
    periodError =
      error instanceof Error ? error.message : "Informe um período válido.";
  }

  const report = await getAttendanceReport(organization.id, period);

  return (
    <main
      className="platform-page organization-themed-page reports-page"
      style={brandThemeStyle(organization.primaryColor)}
    >
      <header className="platform-header">
        <div>
          <p className="kicker">Histórico de atendimentos</p>
          <h1>Relatórios</h1>
          <p>
            Acompanhe as senhas retiradas e os atendimentos concluídos por dia
            ou período.
          </p>
        </div>
        <Link className="secondary-link" href="/app">
          Voltar ao painel
        </Link>
      </header>

      <form className="report-filter" method="get">
        <label>
          <span>Data inicial</span>
          <input
            defaultValue={period.from}
            max={period.to}
            name="from"
            type="date"
          />
        </label>
        <label>
          <span>Data final</span>
          <input
            defaultValue={period.to}
            min={period.from}
            name="to"
            type="date"
          />
        </label>
        <button className="primary-button" type="submit">
          Gerar relatório
        </button>
      </form>
      {periodError ? (
        <p className="report-error" role="alert">
          {periodError} Exibindo o mês atual.
        </p>
      ) : null}

      <section className="report-summary" aria-label="Resumo do período">
        <article>
          <small>Senhas retiradas</small>
          <strong>{report.totals.issued}</strong>
          <span>
            {report.totals.priority}{" "}
            {report.totals.priority === 1 ? "prioritária" : "prioritárias"}
          </span>
        </article>
        <article>
          <small>Atendimentos concluídos</small>
          <strong>{report.totals.completed}</strong>
          <span>
            {rate(report.totals.completed, report.totals.issued)}% das retiradas
          </span>
        </article>
        <article>
          <small>Não compareceram</small>
          <strong>{report.totals.noShow}</strong>
          <span>senhas encerradas sem atendimento</span>
        </article>
        <article>
          <small>Pendentes</small>
          <strong>{report.totals.pending}</strong>
          <span>aguardando ou em atendimento</span>
        </article>
      </section>

      <section className="report-card">
        <div className="report-card-heading">
          <div>
            <h2>Resultado por dia</h2>
            <p>
              De {formatDate(report.from)} até {formatDate(report.to)}
            </p>
          </div>
          <span>
            {report.days.length}{" "}
            {report.days.length === 1
              ? "dia com movimento"
              : "dias com movimento"}
          </span>
        </div>
        {report.days.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Retiradas</th>
                  <th>Prioritárias</th>
                  <th>Concluídas</th>
                  <th>Não compareceram</th>
                  <th>Pendentes</th>
                  <th>Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((day) => (
                  <tr key={day.date}>
                    <td>
                      <strong>{formatDate(day.date)}</strong>
                    </td>
                    <td>{day.issued}</td>
                    <td>{day.priority}</td>
                    <td>{day.completed}</td>
                    <td>{day.noShow}</td>
                    <td>{day.pending}</td>
                    <td>
                      <span className="report-rate">
                        {rate(day.completed, day.issued)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="report-empty">
            <strong>Nenhuma senha encontrada</strong>
            <p>Não houve retirada de senhas no período selecionado.</p>
          </div>
        )}
      </section>

      {report.services.length ? (
        <section className="report-card">
          <div className="report-card-heading">
            <div>
              <h2>Resultado por serviço</h2>
              <p>Comparativo dos serviços procurados no período.</p>
            </div>
          </div>
          <div className="report-service-list">
            {report.services.map((service) => (
              <article key={service.service}>
                <div>
                  <strong>{service.service}</strong>
                  <span>
                    {service.issued}{" "}
                    {service.issued === 1
                      ? "senha retirada"
                      : "senhas retiradas"}
                  </span>
                </div>
                <div>
                  <small>Atendidas</small>
                  <strong>{service.completed}</strong>
                </div>
                <div>
                  <small>Não compareceram</small>
                  <strong>{service.noShow}</strong>
                </div>
                <div>
                  <small>Conclusão</small>
                  <strong>{rate(service.completed, service.issued)}%</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
