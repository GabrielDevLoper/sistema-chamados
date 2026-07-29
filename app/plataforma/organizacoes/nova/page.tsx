import { requirePlatformAdminPage } from "../../../platform-auth";
import { OrganizationForm } from "../organization-form";

export default async function NewOrganizationPage() {
  await requirePlatformAdminPage("/plataforma/organizacoes/nova");
  return (
    <main className="platform-page narrow">
      <header className="platform-header">
        <div>
          <p className="kicker">Novo cliente</p>
          <h1>Cadastrar organização</h1>
          <p>Crie a conta única e a identidade inicial da organização.</p>
        </div>
      </header>
      <OrganizationForm />
    </main>
  );
}
