"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return <button className="secondary-link" onClick={logout} type="button">Sair</button>;
}
