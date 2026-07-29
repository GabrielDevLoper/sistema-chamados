import { SetupForm } from "./setup-form";

export default function AdminSetupPage() {
  return (
    <main className="simple-page">
      <section className="simple-card auth-card">
        <p className="kicker">Configuração inicial</p>
        <h1>Criar administrador</h1>
        <p>Esta etapa funciona uma única vez e exige o código seguro configurado no ambiente.</p>
        <SetupForm />
      </section>
    </main>
  );
}
