"use client";

import { useState } from "react";

export function AccountSecurity() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(formData: FormData) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/app/account/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Não foi possível alterar.");
      setBusy(false);
      return;
    }
    window.location.href = "/login";
  }

  async function revokeAll() {
    if (!window.confirm("Encerrar o acesso em todos os dispositivos?")) return;
    setBusy(true);
    await fetch("/api/app/sessions", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="account-grid">
      <form action={change} className="management-card auth-form">
        <h2>Alterar senha</h2>
        <p>A troca encerra todas as sessões, inclusive esta.</p>
        <label><span>Senha atual</span><input autoComplete="current-password" name="currentPassword" required type="password" /></label>
        <label><span>Nova senha</span><input autoComplete="new-password" minLength={12} name="newPassword" required type="password" /></label>
        <button className="primary-button" disabled={busy}>Alterar senha</button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
      <section className="management-card">
        <h2>Encerrar sessões</h2>
        <p>Desconecte esta conta de todos os computadores e televisores.</p>
        <button className="secondary-link danger" disabled={busy} onClick={revokeAll} type="button">Sair de todos os dispositivos</button>
      </section>
    </div>
  );
}
