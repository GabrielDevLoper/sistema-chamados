"use client";

import { useState } from "react";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const data = (await response.json()) as {
        user?: { redirectTo: string };
        error?: string;
      };
      if (!response.ok || !data.user) throw new Error(data.error || "Não foi possível entrar.");
      window.location.href = data.user.redirectTo;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="auth-form">
      <label>
        <span>E-mail</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        <span>Senha</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      <button className="primary-button" disabled={busy} type="submit">
        {busy ? "Entrando…" : "Entrar"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
