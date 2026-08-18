"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type {
  Organization,
  QueueDesk,
  QueueSector,
  QueueService,
} from "../../db/types";
import { brandThemeStyle } from "../brand-theme";
import { publicOrganizationAssetUrl } from "../organization-media";

type Section = "services" | "sectors" | "desks" | "branding";

export function OrganizationManagement({
  section,
  organization,
  services,
  sectors,
  desks,
}: {
  section: Section;
  organization: Organization;
  services: QueueService[];
  sectors: QueueSector[];
  desks: QueueDesk[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewColor, setPreviewColor] = useState(organization.primaryColor);
  const logoUrl = publicOrganizationAssetUrl(organization.slug, "logo", organization.logoKey);
  const displayLogoUrl = publicOrganizationAssetUrl(
    organization.slug,
    "display-logo",
    organization.displayLogoKey,
  );
  const backgroundUrl = publicOrganizationAssetUrl(
    organization.slug,
    "background",
    organization.displayBackgroundKey,
  );

  async function request(path: string, method: "POST" | "PUT" | "DELETE", payload: Record<string, unknown>) {
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

  async function remove(path: string, label: string) {
    if (!window.confirm(`Excluir ${label}? Esta ação não poderá ser desfeita.`)) return;
    await request(path, "DELETE", {});
  }

  function fields(formData: FormData) {
    return Object.fromEntries(formData.entries());
  }

  function sectorFields(formData: FormData) {
    return {
      ...fields(formData),
      serviceIds: formData.getAll("serviceIds").map(Number),
    };
  }

  async function saveBranding(formData: FormData) {
    const logo = formData.get("logo");
    const displayLogo = formData.get("displayLogo");
    const background = formData.get("background");
    const payload = Object.fromEntries(
      [...formData.entries()].filter(
        ([name]) => name !== "logo" && name !== "displayLogo" && name !== "background",
      )
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
      if (displayLogo instanceof File && displayLogo.size > 0) {
        const displayLogoForm = new FormData();
        displayLogoForm.set("displayLogo", displayLogo);
        const upload = await fetch("/api/app/display-logo", {
          method: "PUT",
          body: displayLogoForm,
        });
        const uploadData = (await upload.json()) as { error?: string };
        if (!upload.ok) throw new Error(uploadData.error || "Não foi possível enviar a logo do painel.");
      }
      if (background instanceof File && background.size > 0) {
        const backgroundForm = new FormData();
        backgroundForm.set("background", background);
        const upload = await fetch("/api/app/background", {
          method: "PUT",
          body: backgroundForm,
        });
        const uploadData = (await upload.json()) as { error?: string };
        if (!upload.ok) throw new Error(uploadData.error || "Não foi possível enviar a imagem de fundo.");
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
        <Link className={section === "sectors" ? "active" : ""} href="/app/setores">Setores</Link>
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
                <div className="management-row-actions">
                  <button className="secondary-link" disabled={busy}>Salvar</button>
                  <button
                    aria-label={`Excluir serviço ${service.name}`}
                    className="delete-button"
                    disabled={busy}
                    onClick={() => remove(`/api/app/services/${service.id}`, `o serviço “${service.name}”`)}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : section === "sectors" ? (
        <section className="management-card">
          <div className="management-title">
            <div>
              <h2>Setores</h2>
              <p>Agrupe os serviços que cada conjunto de guichês pode atender.</p>
            </div>
          </div>
          <form
            action={(data) => request("/api/app/sectors", "POST", sectorFields(data))}
            className="sector-create-form"
          >
            <label>
              <span>Nome do setor</span>
              <input name="name" placeholder="Ex.: Reconhecimento de firma" required />
            </label>
            <label>
              <span>Descrição</span>
              <input name="description" placeholder="Orientação opcional para a equipe" />
            </label>
            <fieldset className="service-checklist">
              <legend>Serviços atendidos</legend>
              {services.filter((service) => service.active).map((service) => (
                <label key={service.id}>
                  <input name="serviceIds" type="checkbox" value={service.id} />
                  <span>{service.name}</span>
                </label>
              ))}
            </fieldset>
            <button className="primary-button" disabled={busy}>Adicionar setor</button>
          </form>
          <div className="sector-management-list">
            {sectors.map((sector) => (
              <form
                action={(data) => request(`/api/app/sectors/${sector.id}`, "PUT", {
                  ...sectorFields(data),
                  active: data.get("active") === "on",
                })}
                className="sector-management-form"
                key={sector.id}
              >
                <div className="sector-form-heading">
                  <label>
                    <span>Nome do setor</span>
                    <input defaultValue={sector.name} name="name" required />
                  </label>
                  <label>
                    <span>Descrição</span>
                    <input defaultValue={sector.description} name="description" />
                  </label>
                </div>
                <fieldset className="service-checklist">
                  <legend>Serviços deste setor</legend>
                  {services.map((service) => (
                    <label key={service.id}>
                      <input
                        defaultChecked={sector.serviceIds.includes(service.id)}
                        name="serviceIds"
                        type="checkbox"
                        value={service.id}
                      />
                      <span>{service.name}{service.active ? "" : " (inativo)"}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="sector-form-actions">
                  <label className="compact-toggle">
                    <input defaultChecked={sector.active} name="active" type="checkbox" />
                    <span>{sector.active ? "Setor ativo" : "Setor inativo"}</span>
                  </label>
                  <div className="management-row-actions">
                    <button className="secondary-link" disabled={busy}>Salvar setor</button>
                    <button
                      aria-label={`Excluir setor ${sector.name}`}
                      className="delete-button"
                      disabled={busy}
                      onClick={() => remove(`/api/app/sectors/${sector.id}`, `o setor “${sector.name}”`)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : section === "desks" ? (
        <section className="management-card">
          <div className="management-title"><div><h2>Guichês</h2><p>Defina o setor de cada balcão para limitar os serviços que ele recebe.</p></div></div>
          <form action={(data) => request("/api/app/desks", "POST", fields(data))} className="inline-create-form desk-create-form">
            <input name="name" placeholder="Nome do guichê" required />
            <input min={1} name="number" placeholder="Número" required type="number" />
            <select name="sectorId" required>
              <option value="">Selecione o setor</option>
              {sectors.filter((sector) => sector.active).map((sector) => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
            <button className="primary-button" disabled={busy}>Adicionar</button>
          </form>
          <div className="management-list desk-management-list">
            {desks.map((desk) => (
              <form action={(data) => request(`/api/app/desks/${desk.id}`, "PUT", { ...fields(data), active: data.get("active") === "on" })} key={desk.id}>
                <input defaultValue={desk.name} name="name" required />
                <input defaultValue={desk.number} min={1} name="number" required type="number" />
                <select defaultValue={desk.sectorId} name="sectorId" required>
                  {sectors.filter((sector) => sector.active || sector.id === desk.sectorId).map((sector) => (
                    <option key={sector.id} value={sector.id}>{sector.name}</option>
                  ))}
                </select>
                <label className="compact-toggle"><input defaultChecked={desk.active} name="active" type="checkbox" /><span>{desk.active ? "Ativo" : "Inativo"}</span></label>
                <div className="management-row-actions">
                  <button className="secondary-link" disabled={busy}>Salvar</button>
                  <button
                    aria-label={`Excluir guichê ${desk.name}`}
                    className="delete-button"
                    disabled={busy}
                    onClick={() => remove(`/api/app/desks/${desk.id}`, `o guichê “${desk.name}”`)}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>
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
            <label className="branding-logo-field">
              <span>Logo da retirada de senhas</span>
              <input accept="image/png,image/jpeg,image/webp" name="logo" type="file" />
              {logoUrl ? (
                <span className="active-logo-preview">
                  <small>Logo ativa</small>
                  <Image
                    alt={`Logo ativa da ${organization.tradeName}`}
                    height={72}
                    src={logoUrl}
                    unoptimized
                    width={180}
                  />
                </span>
              ) : (
                <small className="active-logo-empty">Nenhuma logo ativa cadastrada.</small>
              )}
            </label>
            <label className="branding-logo-field">
              <span>Logo do painel de chamados</span>
              <input accept="image/png,image/jpeg,image/webp" name="displayLogo" type="file" />
              {displayLogoUrl ? (
                <span className="active-logo-preview">
                  <small>Logo ativa do painel</small>
                  <Image
                    alt={`Logo do painel de ${organization.tradeName}`}
                    height={72}
                    src={displayLogoUrl}
                    unoptimized
                    width={180}
                  />
                </span>
              ) : (
                <small className="active-logo-empty">O painel usará a logo da retirada até você cadastrar outra.</small>
              )}
            </label>
            <label className="branding-background-field"><span>Imagem de fundo do painel</span><input accept="image/png,image/jpeg,image/webp" name="background" type="file" /><small>Use uma imagem horizontal, de preferência 16:9. Até 5 MB e 4096 × 4096 pixels.</small></label>
            <button className="primary-button" disabled={busy}>Salvar identidade</button>
          </form>
          <div
            className={`brand-preview${backgroundUrl ? " has-background" : ""}`}
            aria-live="polite"
            style={backgroundUrl ? { backgroundImage: `linear-gradient(rgba(8, 26, 24, 0.74), rgba(8, 26, 24, 0.74)), url("${backgroundUrl}")` } : undefined}
          >
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
          <p className="storage-note">Cada logo: PNG, JPEG ou WebP; até 2 MB e 2048 × 2048 pixels. Fundo: PNG, JPEG ou WebP; até 5 MB e 4096 × 4096 pixels.</p>
        </section>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </main>
  );
}
