import {
  authenticateRequest,
  AuthenticationError,
} from "../db/auth";
import { requirePageUser } from "./auth";

export { AuthenticationError as AuthorizationError };

export async function authorizePlatformAdmin(request: Request) {
  const user = await authenticateRequest(request);
  if (user.role !== "platform_admin") {
    throw new AuthenticationError("Acesso restrito ao administrador da plataforma.", 403);
  }
  return user;
}

export async function requirePlatformAdminPage(returnTo: string) {
  return requirePageUser("platform_admin", returnTo);
}
