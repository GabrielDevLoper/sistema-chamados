import { getOrganizationConfiguration } from "../../../db/organization-settings";
import { requireOrganizationPage } from "../../organization-auth";
import { OrganizationManagement } from "../management";

export default async function ServicesPage() {
  const { organization } = await requireOrganizationPage("/app/servicos");
  const configuration = await getOrganizationConfiguration(organization.id);
  return <OrganizationManagement section="services" organization={organization} {...configuration} />;
}
