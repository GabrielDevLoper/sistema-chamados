"use client";

import Link from "next/link";
import { useState } from "react";
import type { Organization, QueueDesk, QueueService } from "../../db/types";
import { brandThemeStyle } from "../brand-theme";

type Section = "services" | "desks" | "branding";

export function OrganizationManagement({
  section,
  organization,
  services,
  desks,
}: {
  section: Section;
  organization: Organization;
  services: QueueService[];
  desks: QueueDesk[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewColor, setPreviewColor] = useState(organization.primaryColor);

  async function request(path: string, method: "POST" | "PUT", payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  function fields(formData: FormData) {
    return Object.fromEntries(formData.entries());
  }

  async function saveBranding(formData: FormData) {
    const logo = formData.get("logo");
    const payload = Object.fromEntries(
      [...formData.entries()].filter(([name]) => name !== "logo")
    );
    setBusy(true);
    setError("");
    try {
      const branding = await fetch("/api/app/branding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const brandingData = (await branding.json()) as { error?: string };
      if (!branding.ok) throw new Error(brandingData.error || "Não foi possível salvar.");
      if (logo instanceof File && logo.size > 0) {
        const logoForm = new FormData();
        logoForm.set("logo", logo);
        const upload = await fetch("/api/app/logo", { method: "PUT", body: logoForm });
        const uploadData = (await upload.json()) as { error?: string };
        if (!upload.ok) throw new Error(uploadData.error || "Não foi possível enviar a logo.");
      }
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  return (
    <main
      className="platform-page organization-themed-page narrow"
      style={brandThemeStyle(previewColor)}
    >
      <header className="platform-header">
        <div><p className="kicker">Configurações</p><h1>{organization.tradeName}</h1><p>Personalize a estrutura usada pela sua equipe e pelos clientes.</p></div>
        <Link className="secondary-link" href="/app">Voltar ao painel</Link>
      </header>
      <nav className="management-tabs">
        <Link className={section === "services" ? "active" : ""} href="/app/servicos">Serviços</Link>
        <Link className={section === "desks" ? "active" : ""} href="/app/guiches">Guichês</Link>
        <Link className={section === "branding" ? "active" : ""} href="/app/identidade">Identidade</Link>
      </nav>

      {section === "services" ? (
        <section className="management-card">
          <div className="management-title"><div><h2>Serviços</h2><p>Serviços ativos aparecem na retirada de senha.</p></div></div>
          <form action={(data) => request("/api/app/services", "POST", fields(data))} className="inline-create-form">
            <input name="name" placeholder="Nome do serviço" required />
            <input maxLength={3} name="ticketPrefix" placeholder="Prefixo" required />
            <button className="primary-button" disabled={busy}>Adicionar</button>
          </form>
          <div className="management-list">
            {services.map((service) => (
              <form action={(data) => request(`/api/app/services/${service.id}`, "PUT", { ...fields(data), active: data.get("active") === "on" })} key={service.id}>
                <input defaultValue={service.name} name="name" required />
                <input defaultValue={service.ticketPrefix} maxLength={3} name="ticketPrefix" required />
                <label className="compact-toggle"><input defaultChecked={service.active} name="active" type="checkbox" /><span>{service.active ? "Ativo" : "Inativo"}</span></label>
                <button className="secondary-link" disabled={busy}>Salvar</button>
              </form>
            ))}
          </div>
        </section>
      ) : section === "desks" ? (
        <section className="management-card">
          <div className="management-title"><div><h2>Guichês</h2><p>Desative guichês sem apagar o histórico de chamadas.</p></div></div>
          <form action={(data) => request("/api/app/desks", "POST", fields(data))} className="inline-create-form">
            <input name="name" placeholder="Nome do guichê" required />
            <input min={1} name="number" placeholder="Número" required type="number" />
            <button className="primary-button" disabled={busy}>Adicionar</button>
          </form>
          <div className="management-list">
            {desks.map((desk) => (
              <form action={(data) => request(`/api/app/desks/${desk.id}`, "PUT", { ...fields(data), active: data.get("active") === "on" })} key={desk.id}>
                <input defaultValue={desk.name} name="name" required />
                <input defaultValue={desk.number} min={1} name="number" required type="number" />
                <label className="compact-toggle"><input defaultChecked={desk.active} name="active" type="checkbox" /><span>{desk.active ? "Ativo" : "Inativo"}</span></label>
                <button className="secondary-link" disabled={busy}>Salvar</button>
              </form>
            ))}
          </div>
        </section>
      ) : (
        <section className="management-card">
          <div className="management-title"><div><h2>Identidade visual</h2><p>As alterações aparecem nas telas públicas sem duplicar componentes.</p></div></div>
          <form action={saveBranding} className="branding-form">
            <label><span>Nome fantasia</span><input defaultValue={organization.tradeName} name="tradeName" required /></label>
            <label><span>Cor primária</span><input name="primaryColor" onChange={(event) => setPreviewColor(event.target.value)} type="color" value={previewColor} /></label>
            <label><span>Fuso horário</span><input defaultValue={organization.timezone} name="timezone" required /></label>
            <label><span>Logo</span><input accept="image/png,image/jpeg,image/webp" name="logo" type="file" /></label>
            <button className="primary-button" disabled={busy}>Salvar identidade</button>
          </form>
          <div className="brand-preview" aria-live="polite">
            <div>
              <small>Prévia do painel de chamadas</small>
              <strong>A001</strong>
              <span>Dirija-se ao Guichê 01</span>
            </div>
            <aside>
              <small>Cor selecionada</small>
              <i style={{ background: previewColor }} />
              <strong>{previewColor.toUpperCase()}</strong>
            </aside>
          </div>
          <p className="storage-note">PNG, JPEG ou WebP; até 2 MB e 2048 × 2048 pixels.</p>
        </section>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </main>
  );
}
