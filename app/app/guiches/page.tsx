import { getOrganizationConfiguration } from "../../../db/organization-settings";
import { requireOrganizationPage } from "../../organization-auth";
import { OrganizationManagement } from "../management";

export default async function DesksPage() {
  const { organization } = await requireOrganizationPage("/app/guiches");
  const configuration = await getOrganizationConfiguration(organization.id);
  return <OrganizationManagement section="desks" organization={organization} {...configuration} />;
}
