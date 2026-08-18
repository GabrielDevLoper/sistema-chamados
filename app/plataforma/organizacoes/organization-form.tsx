"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import type { OrganizationSummary } from "../../../db/platform";
import { brandThemeStyle } from "../../brand-theme";
import { publicOrganizationAssetUrl } from "../../organization-media";

export function OrganizationForm({
  organization,
}: {
  organization?: OrganizationSummary;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeLogoKey, setActiveLogoKey] = useState(organization?.logoKey ?? null);
  const [activeDisplayLogoKey, setActiveDisplayLogoKey] = useState(organization?.displayLogoKey ?? null);
  const [previewColor, setPreviewColor] = useState(
    organization?.primaryColor ?? "#1F5B55"
  );
  const editing = Boolean(organization);

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    setSaved(false);
    const logo = formData.get("logo");
    const displayLogo = formData.get("displayLogo");
    const payload = Object.fromEntries(
      [...formData.entries()].filter(([name]) => name !== "logo" && name !== "displayLogo")
    );
    try {
      const response = await fetch(
        editing
          ? `/api/platform/organizations/${organization?.id}`
          : "/api/platform/organizations",
        {
          method: editing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json()) as {
        organization?: OrganizationSummary;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      const organizationId = data.organization?.id ?? organization?.id;
      if (logo instanceof File && logo.size > 0 && organizationId) {
        const logoForm = new FormData();
        logoForm.set("logo", logo);
        const logoResponse = await fetch(
          `/api/platform/organizations/${organizationId}/logo`,
          { method: "PUT", body: logoForm }
        );
        const logoData = (await logoResponse.json()) as { error?: string; logoKey?: string };
        if (!logoResponse.ok) throw new Error(logoData.error || "Não foi possível enviar a logo.");
        if (typeof logoData.logoKey === "string") {
          setActiveLogoKey(logoData.logoKey);
        }
      }
      if (displayLogo instanceof File && displayLogo.size > 0 && organizationId) {
        const displayLogoForm = new FormData();
        displayLogoForm.set("displayLogo", displayLogo);
        const displayLogoResponse = await fetch(
          `/api/platform/organizations/${organizationId}/display-logo`,
          { method: "PUT", body: displayLogoForm },
        );
        const displayLogoData = (await displayLogoResponse.json()) as {
          error?: string;
          displayLogoKey?: string;
        };
        if (!displayLogoResponse.ok) {
          throw new Error(displayLogoData.error || "Não foi possível enviar a logo do painel.");
        }
        if (typeof displayLogoData.displayLogoKey === "string") {
          setActiveDisplayLogoKey(displayLogoData.displayLogoKey);
        }
      }
      if (!editing && organizationId) {
        window.location.href = `/plataforma/organizacoes/${organizationId}`;
        return;
      }
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const activeLogoUrl = organization
    ? publicOrganizationAssetUrl(organization.slug, "logo", activeLogoKey)
    : undefined;
  const activeDisplayLogoUrl = organization
    ? publicOrganizationAssetUrl(organization.slug, "display-logo", activeDisplayLogoKey)
    : undefined;

  return (
    <form
      action={submit}
      className="platform-form organization-themed-form"
      style={brandThemeStyle(previewColor)}
    >
      <div className="platform-form-grid">
        <label>
          <span>Nome fantasia</span>
          <input defaultValue={organization?.tradeName} maxLength={100} name="tradeName" required />
        </label>
        <label>
          <span>Endereço público</span>
          <div className="slug-input">
            <small>/fila/</small>
            <input defaultValue={organization?.slug} maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
          </div>
        </label>
        <label>
          <span>Segmento</span>
          <select defaultValue={organization?.businessType ?? "other"} name="businessType">
            <option value="registry">Cartório</option>
            <option value="clinic">Clínica</option>
            <option value="petshop">Pet shop</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select defaultValue={organization?.status ?? "pending"} name="status">
            <option value="pending">Pendente</option>
            <option value="active">Ativa</option>
            <option value="suspended">Suspensa</option>
          </select>
        </label>
        <label>
          <span>Cor primária</span>
          <input
            name="primaryColor"
            onChange={(event) => setPreviewColor(event.target.value)}
            type="color"
            value={previewColor}
          />
        </label>
        <label>
          <span>Fuso horário</span>
          <input defaultValue={organization?.timezone ?? "America/Maceio"} name="timezone" required />
        </label>
        <label>
          <span>Responsável pela conta</span>
          <input defaultValue={organization?.accountName ?? organization?.tradeName} maxLength={100} name="accountName" required />
        </label>
        <label>
          <span>{editing && organization?.accountEmail ? "Nova senha (opcional)" : "Senha inicial"}</span>
          <input autoComplete="new-password" minLength={6} name="accountPassword" required={!editing || !organization?.accountEmail} type="password" />
          <small>Mínimo de 6 caracteres, sem regras de complexidade.</small>
        </label>
        <label>
          <span>E-mail de acesso</span>
          <input defaultValue={organization?.accountEmail ?? ""} maxLength={254} name="accountEmail" required type="email" />
        </label>
        <label className="platform-logo-field">
          <span>Logo da retirada de senhas</span>
          <input accept="image/png,image/jpeg,image/webp" name="logo" type="file" />
          {activeLogoUrl ? (
            <span className="active-logo-preview">
              <small>Logo ativa</small>
              <Image
                alt={`Logo ativa da ${organization?.tradeName ?? "organização"}`}
                height={72}
                src={activeLogoUrl}
                unoptimized
                width={180}
              />
            </span>
          ) : (
            <small className="active-logo-empty">Nenhuma logo ativa cadastrada.</small>
          )}
          <small>PNG, JPEG ou WebP; até 2 MB e 2048 × 2048.</small>
        </label>
        <label className="platform-logo-field">
          <span>Logo do painel de chamados</span>
          <input accept="image/png,image/jpeg,image/webp" name="displayLogo" type="file" />
          {activeDisplayLogoUrl ? (
            <span className="active-logo-preview">
              <small>Logo ativa do painel</small>
              <Image
                alt={`Logo do painel de ${organization?.tradeName ?? "organização"}`}
                height={72}
                src={activeDisplayLogoUrl}
                unoptimized
                width={180}
              />
            </span>
          ) : (
            <small className="active-logo-empty">O painel usará a logo da retirada até você cadastrar outra.</small>
          )}
          <small>PNG, JPEG ou WebP; até 2 MB e 2048 × 2048.</small>
        </label>
      </div>
      <div className="brand-preview compact">
        <div>
          <small>Prévia da identidade</small>
          <strong>A001</strong>
          <span>A cor será aplicada ao painel, totem e atendimento.</span>
        </div>
        <aside>
          <small>Cor</small>
          <i style={{ background: previewColor }} />
          <strong>{previewColor.toUpperCase()}</strong>
        </aside>
      </div>
      <div className="platform-form-actions">
        <Link className="secondary-link" href="/plataforma/organizacoes">Cancelar</Link>
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar organização"}
        </button>
      </div>
      {saved ? <p className="admin-success">✓ Alterações salvas.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
