import { currentPageUser } from "../auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await currentPageUser();
  if (user) redirect(user.role === "platform_admin" ? "/plataforma/organizacoes" : "/app");
  return (
    <main className="simple-page">
      <section className="simple-card auth-card">
        <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span><strong>Sistema de filas</strong><small>Acesso seguro</small></span></div>
        <p className="kicker">Área restrita</p>
        <h1>Entrar na sua conta</h1>
        <p>Use o acesso criado pelo administrador da plataforma.</p>
        <LoginForm />
      </section>
    </main>
  );
}
