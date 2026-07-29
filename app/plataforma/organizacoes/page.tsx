import Link from "next/link";
import { requirePlatformAdminPage } from "../../platform-auth";
import { listOrganizationSummaries } from "../../../db/platform";
import { LogoutButton } from "../logout-button";

const STATUS_LABEL = {
  pending: "Pendente",
  active: "Ativa",
  suspended: "Suspensa",
};

export default async function OrganizationsPage() {
  const user = await requirePlatformAdminPage("/plataforma/organizacoes");
  const organizations = await listOrganizationSummaries();

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="kicker">Administração da plataforma</p>
          <h1>Organizações</h1>
          <p>Gerencie os clientes que utilizam o sistema de filas.</p>
        </div>
        <div className="platform-header-actions">
          <span>{user.name}</span>
          <LogoutButton />
          <Link className="primary-link" href="/plataforma/organizacoes/nova">Nova organização</Link>
        </div>
      </header>

      <section className="organization-table-card">
        {organizations.length ? (
          <div className="organization-table">
            <div className="organization-table-row heading">
              <span>Organização</span><span>Acesso</span><span>Status</span><span />
            </div>
            {organizations.map((organization) => (
              <div className="organization-table-row" key={organization.id}>
                <span>
                  <i style={{ background: organization.primaryColor }} />
                  <strong>{organization.tradeName}</strong>
                  <small>/fila/{organization.slug}</small>
                </span>
                <span>{organization.accountEmail ?? "Conta não configurada"}</span>
                <span className={`status-badge ${organization.status}`}>
                  {STATUS_LABEL[organization.status]}
                </span>
                <a href={`/plataforma/organizacoes/${organization.id}`}>Editar →</a>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-platform-list">
            <h2>Nenhuma organização cadastrada</h2>
            <p>Cadastre o primeiro cliente para preparar sua identidade e fila.</p>
          </div>
        )}
      </section>
    </main>
  );
}
