import { getOrganizationConfiguration } from "../../../db/organization-settings";
import { requireOrganizationPage } from "../../organization-auth";
import { OrganizationManagement } from "../management";

export default async function BrandingPage() {
  const { organization } = await requireOrganizationPage("/app/identidade");
  const configuration = await getOrganizationConfiguration(organization.id);
  return <OrganizationManagement section="branding" organization={organization} {...configuration} />;
}
