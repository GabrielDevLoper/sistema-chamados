import Link from "next/link";
import { requireOrganizationPage } from "../organization-auth";
import { LogoutButton } from "../plataforma/logout-button";
import { brandThemeStyle } from "../brand-theme";

export default async function OrganizationHomePage() {
  const { user, organization } = await requireOrganizationPage("/app");
  return (
    <main
      className="platform-page organization-themed-page"
      style={brandThemeStyle(organization.primaryColor)}
    >
      <header className="platform-header">
        <div>
          <p className="kicker">Painel da organização</p>
          <h1>{organization.tradeName}</h1>
          <p>Olá, {user.name}. Escolha o que deseja fazer.</p>
        </div>
        <LogoutButton />
      </header>
      <section className="organization-home-grid">
        <Link href="/app/atendimento"><small>Operação</small><strong>Atender a fila</strong><span>Selecionar o guichê e chamar senhas →</span></Link>
        <a href={`/fila/${organization.slug}/cliente`}><small>Público</small><strong>Retirada de senha</strong><span>Abrir a tela dos clientes →</span></a>
        <a href={`/fila/${organization.slug}/painel`}><small>Público</small><strong>Painel de chamadas</strong><span>Abrir o painel da TV →</span></a>
        <Link href="/app/servicos"><small>Gestão</small><strong>Serviços</strong><span>Organizar opções de atendimento →</span></Link>
        <Link href="/app/guiches"><small>Gestão</small><strong>Guichês</strong><span>Cadastrar e desativar guichês →</span></Link>
        <Link href="/app/identidade"><small>Marca</small><strong>Identidade visual</strong><span>Nome, cor e fuso horário →</span></Link>
        <Link href="/app/conta"><small>Segurança</small><strong>Conta e sessões</strong><span>Alterar senha e desconectar dispositivos →</span></Link>
      </section>
    </main>
  );
}
