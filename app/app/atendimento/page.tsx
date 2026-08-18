import { QueueApp } from "../../queue-app";
import { requireOrganizationPage } from "../../organization-auth";

export default async function OrganizationServicePage() {
  const { organization } = await requireOrganizationPage("/app/atendimento");
  return (
    <QueueApp
      authenticated
      initialMode="attendant"
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
