import Link from "next/link";
import { listActiveSessions } from "../../../db/login";
import { requireOrganizationPage } from "../../organization-auth";
import { AccountSecurity } from "./account-security";

export default async function AccountPage() {
  const { user, organization } = await requireOrganizationPage("/app/conta");
  const sessions = await listActiveSessions(user.id);
  return (
    <main className="platform-page narrow">
      <header className="platform-header"><div><p className="kicker">Segurança</p><h1>Conta de {organization.tradeName}</h1><p>{user.email} · {sessions.length} {sessions.length === 1 ? "sessão ativa" : "sessões ativas"}</p></div><Link className="secondary-link" href="/app">Voltar</Link></header>
      <AccountSecurity />
    </main>
  );
}
