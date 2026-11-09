import Link from "next/link";

const features = [
  {
    tag: "01",
    title: "Filas organizadas",
    text: "Separe atendimentos por serviço e setor, com prioridade e ordem de chegada respeitadas automaticamente.",
  },
  {
    tag: "02",
    title: "Chamadas por senha",
    text: "O cliente retira a senha no totem ou no celular e acompanha a vez. O atendente chama a próxima — ou uma senha específica — com um clique.",
  },
  {
    tag: "03",
    title: "Painéis de atendimento",
    text: "Painel de TV com aviso sonoro, guichê de destino e últimas chamadas, com a identidade visual da sua organização.",
  },
  {
    tag: "04",
    title: "Multi-organização",
    text: "Cada organização tem seu endereço, logo, cores, serviços e equipe — tudo isolado e gerenciado em uma única plataforma.",
  },
];

const steps = [
  { title: "Retirada", text: "O cliente escolhe o serviço e recebe a senha impressa ou na tela." },
  { title: "Chamada", text: "O atendente chama pelo guichê e a senha aparece no painel." },
  { title: "Gestão", text: "O administrador acompanha relatórios, setores e guichês." },
];

const roles = [
  { title: "Administrador", text: "Configura serviços, setores, guichês, identidade visual e acessos da equipe." },
  { title: "Atendente", text: "Vê a fila em tempo real, chama senhas e registra o atendimento." },
  { title: "Cliente", text: "Retira a senha sem cadastro e sabe exatamente quando será chamado." },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link className="brand" href="/" aria-label="Sistema de filas — início">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>Sistema de filas</strong><small>Atendimento integrado</small></span>
        </Link>
        <nav aria-label="Navegação principal">
          <a className="landing-nav-link" href="#recursos">Recursos</a>
          <a className="landing-nav-link" href="#como-funciona">Como funciona</a>
          <Link className="primary-link" href="/login">Entrar</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="kicker">Plataforma de atendimento</p>
          <h1>Atendimento simples. Filas organizadas.</h1>
          <p className="landing-lead">
            Retirada de senhas, chamadas no painel e gestão de atendimento em uma
            fila integrada — para uma ou várias organizações.
          </p>
          <div className="landing-actions">
            <Link className="primary-link" href="/login">Entrar na minha conta</Link>
            <a className="secondary-link" href="#recursos">Conhecer os recursos</a>
          </div>
        </div>

        <div className="landing-preview" aria-hidden="true">
          <div className="landing-preview-screen">
            <span className="landing-preview-label">Senha chamada</span>
            <strong>P-024</strong>
            <span className="landing-preview-desk">Guichê 3</span>
          </div>
          <ul className="landing-preview-history">
            <li><span>N-118</span><small>Guichê 1</small></li>
            <li><span>N-117</span><small>Guichê 2</small></li>
            <li><span>P-023</span><small>Guichê 3</small></li>
          </ul>
        </div>
      </section>

      <section className="landing-section" id="recursos" aria-labelledby="recursos-titulo">
        <p className="kicker">Recursos</p>
        <h2 id="recursos-titulo">Tudo o que a recepção precisa, sem complicação</h2>
        <div className="landing-grid">
          {features.map((feature) => (
            <article className="landing-card" key={feature.title}>
              <span className="landing-card-tag">{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="como-funciona" aria-labelledby="como-titulo">
        <p className="kicker">Como funciona</p>
        <h2 id="como-titulo">Da senha ao atendimento em três passos</h2>
        <ol className="landing-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="landing-step-number">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="landing-roles">
          {roles.map((role) => (
            <div key={role.title}>
              <h3>{role.title}</h3>
              <p>{role.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-titulo">
        <h2 id="cta-titulo">Pronto para organizar seu atendimento?</h2>
        <p>
          Equipes entram com o acesso criado pelo administrador. Clientes retiram
          senha pelo endereço público da sua organização.
        </p>
        <Link className="primary-link" href="/login">Entrar</Link>
      </section>

      <footer className="landing-footer">
        <span>Sistema de filas</span>
        <Link href="/plataforma/login">Acesso da plataforma</Link>
      </footer>
    </main>
  );
}
