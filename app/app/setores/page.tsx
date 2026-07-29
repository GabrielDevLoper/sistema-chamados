import { getOrganizationConfiguration } from "../../../db/organization-settings";
import { requireOrganizationPage } from "../../organization-auth";
import { OrganizationManagement } from "../management";

export default async function SectorsPage() {
  const { organization } = await requireOrganizationPage("/app/setores");
  const configuration = await getOrganizationConfiguration(organization.id);
  return (
    <OrganizationManagement
      section="sectors"
      organization={organization}
      {...configuration}
    />
  );
}
