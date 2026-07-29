"use client";

import { useState } from "react";

export function SetupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível configurar.");
      window.location.href = "/login";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível configurar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="auth-form">
      <label><span>Código de configuração</span><input autoComplete="off" name="setupToken" required type="password" /></label>
      <label><span>Nome</span><input autoComplete="name" name="name" required /></label>
      <label><span>E-mail</span><input autoComplete="email" name="email" required type="email" /></label>
      <label><span>Senha</span><input autoComplete="new-password" minLength={12} name="password" required type="password" /><small>Mínimo de 12 caracteres.</small></label>
      <button className="primary-button" disabled={busy} type="submit">{busy ? "Configurando…" : "Criar administrador"}</button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
