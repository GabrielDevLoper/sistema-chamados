import { authenticateRequest, AuthenticationError } from "../db/auth";
import { getOrganizationById } from "../db/organizations";
import { requirePageUser } from "./auth";

export async function authorizeOrganization(request: Request) {
  const user = await authenticateRequest(request);
  if (user.role !== "organization" || !user.organizationId) {
    throw new AuthenticationError("Acesso restrito à conta da organização.", 403);
  }
  const organization = await getOrganizationById(user.organizationId);
  if (!organization) throw new AuthenticationError("Organização indisponível.", 403);
  return { user, organization };
}

export async function requireOrganizationPage(returnTo: string) {
  const user = await requirePageUser("organization", returnTo);
  if (!user.organizationId) throw new Error("Conta sem organização vinculada.");
  const organization = await getOrganizationById(user.organizationId);
  if (!organization) throw new Error("Organização indisponível.");
  return { user, organization };
}
