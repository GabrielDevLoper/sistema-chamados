import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authenticateRequest,
  AuthenticationError,
  type UserRole,
} from "../db/auth";

export async function currentPageUser() {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}/`, { headers: incoming });
  try {
    return await authenticateRequest(request);
  } catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}

export async function requirePageUser(role: UserRole, returnTo: string) {
  const user = await currentPageUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (user.role !== role) {
    redirect(user.role === "platform_admin" ? "/plataforma/organizacoes" : "/app");
  }
  return user;
}
