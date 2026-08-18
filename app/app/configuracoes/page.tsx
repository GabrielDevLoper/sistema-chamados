import { QueueApp } from "../../queue-app";
import { requireOrganizationPage } from "../../organization-auth";

export default async function OrganizationSettingsPage() {
  const { organization } = await requireOrganizationPage("/app/configuracoes");
  return (
    <QueueApp
      authenticated
      initialMode="admin"
      organizationSlug={organization.slug}
      initialOrganization={{
        tradeName: organization.tradeName,
        slug: organization.slug,
        logoKey: organization.logoKey,
        displayLogoKey: organization.displayLogoKey,
        displayBackgroundKey: organization.displayBackgroundKey,
        primaryColor: organization.primaryColor,
        timezone: organization.timezone,
      }}
    />
  );
}
