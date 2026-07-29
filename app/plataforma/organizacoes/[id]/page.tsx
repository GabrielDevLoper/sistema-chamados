import { notFound } from "next/navigation";
import { requirePlatformAdminPage } from "../../../platform-auth";
import { getOrganizationSummary } from "../../../../db/platform";
import { OrganizationForm } from "../organization-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditOrganizationPage({ params }: PageProps) {
  const { id: rawId } = await params;
  await requirePlatformAdminPage(`/plataforma/organizacoes/${rawId}`);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const organization = await getOrganizationSummary(id);
  if (!organization) notFound();

  return (
    <main className="platform-page narrow">
      <header className="platform-header">
        <div>
          <p className="kicker">Cliente #{organization.id}</p>
          <h1>{organization.tradeName}</h1>
          <p>Atualize o acesso, a marca e o status da organização.</p>
        </div>
        <a className="secondary-link" href={`/fila/${organization.slug}/cliente`}>
          Abrir fila pública
        </a>
      </header>
      <OrganizationForm organization={organization} />
    </main>
  );
}
