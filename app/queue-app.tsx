"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { brandThemeStyle } from "./brand-theme";
import type { QueuePayload, QueueService, Ticket } from "../db/types";

type Mode = "client" | "attendant" | "display" | "admin";
type PublicOrganization = QueuePayload["organization"];

const SERVICE_PRESENTATION: Record<
  string,
  {
    eyebrow: string;
    description: string;
    icon: string;
  }
> = {
  "Atendimento geral": {
    eyebrow: "Serviços diversos",
    description: "Dúvidas, orientações e outros serviços",
    icon: "A",
  },
  Certidões: {
    eyebrow: "2ª via e consultas",
    description: "Nascimento, casamento e óbito",
    icon: "C",
  },
  "Registro e reconhecimento": {
    eyebrow: "Documentos",
    description: "Firmas, autenticações e registros",
    icon: "R",
  },
};

const DEFAULT_ORGANIZATION: PublicOrganization = {
  tradeName: "Cartório",
  slug: "cartorio",
  logoKey: null,
  primaryColor: "#1f5b55",
  timezone: "America/Maceio",
};

const EMPTY_QUEUE: QueuePayload = {
  organization: DEFAULT_ORGANIZATION,
  services: [],
  sectors: [],
  desks: [],
  tickets: [],
  waiting: 0,
  served: 0,
  averageMinutes: 0,
};

function formatTime(date: string | null, timezone: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(date));
}

function formatTicketDate(date: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  }).format(new Date(date));
}

function formatClockTime(date: Date | null, timezone: string) {
  return date
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(date)
    : "--:--";
}

function formatDisplayDate(date: Date | null, timezone: string) {
  return date
    ? new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: timezone,
      }).format(date)
    : "Carregando data…";
}

function servicePresentation(service: QueueService) {
  return (
    SERVICE_PRESENTATION[service.name] ?? {
      eyebrow: "Atendimento",
      description: "Selecione para retirar uma senha",
      icon: service.name.trim().charAt(0).toUpperCase() || "S",
    }
  );
}

function Logo({ organization }: { organization: PublicOrganization }) {
  return (
    <div className="brand" aria-label={organization.tradeName}>
      {organization.logoKey ? (
        <Image
          alt={`Logo da ${organization.tradeName}`}
          className="brand-image"
          height={44}
          src={`/api/public/${encodeURIComponent(organization.slug)}/logo`}
          unoptimized
          width={52}
        />
      ) : (
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <span>
        <strong>{organization.tradeName}</strong>
        <small>Sistema de atendimento</small>
      </span>
    </div>
  );
}

function ModeSwitch({
  mode,
  organizationSlug,
  authenticated,
}: {
  mode: Mode;
  organizationSlug?: string;
  authenticated?: boolean;
}) {
  const publicBase = organizationSlug
    ? `/fila/${encodeURIComponent(organizationSlug)}`
    : "";
  return (
    <nav className="mode-switch" aria-label="Selecionar tela">
      {authenticated ? (
        <>
          <a
            className={mode === "attendant" ? "active" : ""}
            href="/app/atendimento"
          >
            Atendimento
          </a>
          <a
            href={`/fila/${encodeURIComponent(organizationSlug ?? "")}/painel`}
          >
            Painel público
          </a>
          <a
            className={mode === "admin" ? "active" : ""}
            href="/app/configuracoes"
          >
            Configurações
          </a>
        </>
      ) : (
        <>
          <a
            className={mode === "client" ? "active" : ""}
            href={publicBase ? `${publicBase}/cliente` : "/cliente"}
          >
            Retirar senha
          </a>
          {!organizationSlug ? (
            <a
              className={mode === "attendant" ? "active" : ""}
              href="/atendente"
            >
              Área do atendente
            </a>
          ) : null}
          <a
            className={mode === "display" ? "active" : ""}
            href={publicBase ? `${publicBase}/painel` : "/painel"}
          >
            Painel de chamadas
          </a>
          {!organizationSlug ? (
            <a
              className={mode === "admin" ? "active" : ""}
              href="/administrador"
            >
              Administração
            </a>
          ) : null}
        </>
      )}
    </nav>
  );
}

export function QueueApp({
  initialMode,
  organizationSlug,
  initialOrganization,
  authenticated = false,
}: {
  initialMode: Mode;
  organizationSlug?: string;
  initialOrganization?: PublicOrganization;
  authenticated?: boolean;
}) {
  const [queue, setQueue] = useState<QueuePayload>(() => ({
    ...EMPTY_QUEUE,
    organization: initialOrganization ?? DEFAULT_ORGANIZATION,
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [priority, setPriority] = useState(false);
  const [deskId, setDeskId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [displaySound, setDisplaySound] = useState(false);
  const [deskCountDraft, setDeskCountDraft] = useState(4);
  const [savedMessage, setSavedMessage] = useState("");
  const announcedCall = useRef<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const adminConfigLoaded = useRef(false);
  const deskPreferenceLoaded = useRef(false);

  const queueApiPath = authenticated
    ? "/api/tickets"
    : organizationSlug
      ? `/api/public/${encodeURIComponent(organizationSlug)}/tickets`
      : "/api/tickets";

  const loadQueue = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const response = await fetch(queueApiPath, { cache: "no-store" });
        const data = (await response.json()) as QueuePayload & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar a fila.");
        setQueue(data);
        const savedDesk =
          initialMode === "attendant" && !deskPreferenceLoaded.current
            ? Number(
                window.localStorage.getItem(
                  `queue-desk:${data.organization.slug}`,
                ),
              )
            : null;
        deskPreferenceLoaded.current = true;
        setDeskId((currentDeskId) =>
          data.desks.some((desk) => desk.id === savedDesk)
            ? savedDesk
            : data.desks.some((desk) => desk.id === currentDeskId)
              ? currentDeskId
              : (data.desks[0]?.id ?? null),
        );
        setError("");
      } catch {
        setError("Não foi possível conectar à fila. Tente novamente.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [initialMode, queueApiPath],
  );

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const initialLoad = window.setTimeout(() => loadQueue(), 0);
    const initialClock = window.setTimeout(updateClock, 0);
    const refresh = window.setInterval(() => loadQueue(true), 3500);
    const clock = window.setInterval(updateClock, 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearTimeout(initialClock);
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [loadQueue]);

  useEffect(() => {
    const syncFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (initialMode !== "client" || !createdTicket) return;

    const root = document.documentElement;
    const finishPrinting = () => setCreatedTicket(null);
    root.classList.add("printing-ticket");
    window.addEventListener("afterprint", finishPrinting, { once: true });

    const printFrame = window.requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        setError("Não foi possível imprimir o comprovante.");
        setCreatedTicket(null);
      }
    });

    return () => {
      window.cancelAnimationFrame(printFrame);
      window.removeEventListener("afterprint", finishPrinting);
      root.classList.remove("printing-ticket");
    };
  }, [createdTicket, initialMode]);

  useEffect(() => {
    if (!adminConfigLoaded.current && queue.desks.length) {
      setDeskCountDraft(queue.desks.length);
      adminConfigLoaded.current = true;
    }
  }, [queue.desks.length]);

  async function sendAction(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(queueApiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        ticket?: Ticket;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Ação não concluída.");
      await loadQueue(true);
      setError("");
      return data.ticket ?? null;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Ação não concluída.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createTicket(serviceId: number) {
    const ticket = await sendAction({ action: "create", serviceId, priority });
    if (ticket) setCreatedTicket(ticket);
  }

  async function saveDeskConfiguration() {
    setBusy(true);
    setSavedMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deskCount: deskCountDraft }),
      });
      const data = (await response.json()) as {
        deskCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          data.error || "Não foi possível salvar a configuração.",
        );
      }
      await loadQueue(true);
      setSavedMessage(
        `${data.deskCount} ${data.deskCount === 1 ? "guichê configurado" : "guichês configurados"} com sucesso.`,
      );
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar a configuração.",
      );
    } finally {
      setBusy(false);
    }
  }

  const waitingTickets = useMemo(
    () => queue.tickets.filter((ticket) => ticket.status === "waiting"),
    [queue.tickets],
  );
  const selectedDesk = useMemo(
    () => queue.desks.find((desk) => desk.id === deskId) ?? null,
    [queue.desks, deskId],
  );
  const eligibleWaitingTickets = useMemo(
    () =>
      waitingTickets.filter(
        (ticket) =>
          ticket.serviceId !== null &&
          selectedDesk?.serviceIds.includes(ticket.serviceId),
      ),
    [selectedDesk, waitingTickets],
  );
  const eligibleServiceNames = useMemo(
    () =>
      queue.services
        .filter((service) => selectedDesk?.serviceIds.includes(service.id))
        .map((service) => service.name),
    [queue.services, selectedDesk],
  );
  const currentTicket = useMemo(
    () =>
      queue.tickets.find(
        (ticket) => ticket.status === "called" && ticket.deskId === deskId,
      ) ?? null,
    [queue.tickets, deskId],
  );
  const recentTickets = useMemo(
    () =>
      queue.tickets
        .filter((ticket) => ticket.status === "finished")
        .slice(0, 4),
    [queue.tickets],
  );
  const calledTickets = useMemo(
    () =>
      queue.tickets
        .filter((ticket) => ticket.calledAt && ticket.desk)
        .sort(
          (a, b) =>
            new Date(b.calledAt ?? 0).getTime() -
            new Date(a.calledAt ?? 0).getTime(),
        ),
    [queue.tickets],
  );
  const featuredTicket = calledTickets[0] ?? null;
  const previousCalls = calledTickets.slice(1, 5);
  const activeDeskNumbers = useMemo(
    () =>
      new Set(
        queue.tickets
          .filter((ticket) => ticket.status === "called" && ticket.desk)
          .map((ticket) => ticket.desk),
      ),
    [queue.tickets],
  );
  const announceTicket = useCallback((ticket: Ticket) => {
    if (!ticket.desk) return;

    const context = audioContext.current;
    if (context) {
      void context.resume();
      [0, 0.28].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = index === 0 ? 660 : 880;
        gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(
          0.2,
          context.currentTime + delay + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          context.currentTime + delay + 0.22,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + 0.24);
      });
    }

    window.setTimeout(() => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const spokenCode = ticket.code.split("").join(" ");
      const message = new SpeechSynthesisUtterance(
        `Senha ${spokenCode}. Dirija-se ao guichê ${ticket.desk}.`,
      );
      message.lang = "pt-BR";
      message.rate = 0.82;
      message.pitch = 1;
      message.volume = 1;
      window.speechSynthesis.speak(message);
    }, 700);
  }, []);

  useEffect(() => {
    if (
      initialMode !== "display" ||
      !displaySound ||
      !featuredTicket?.calledAt
    ) {
      return;
    }
    const callKey = `${featuredTicket.id}-${featuredTicket.calledAt}`;
    if (announcedCall.current === callKey) return;
    announcedCall.current = callKey;
    announceTicket(featuredTicket);
  }, [announceTicket, displaySound, featuredTicket, initialMode]);

  function enableDisplaySound() {
    if (!audioContext.current) {
      audioContext.current = new AudioContext();
    }
    setDisplaySound(true);
    if (featuredTicket?.calledAt) {
      announcedCall.current = `${featuredTicket.id}-${featuredTicket.calledAt}`;
      announceTicket(featuredTicket);
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setError("Não foi possível ativar a tela cheia neste dispositivo.");
    }
  }

  return (
    <main
      className={`app-shell ${initialMode}`}
      style={brandThemeStyle(queue.organization.primaryColor)}
    >
      {initialMode === "display" ? (
        <header className="display-header">
          <Logo organization={queue.organization} />
          <div className="display-status">
            <span className="status-dot" />
            <span>Atendimento em funcionamento</span>
          </div>
          <div className="display-clock">
            <span>{formatDisplayDate(now, queue.organization.timezone)}</span>
            <strong>{formatClockTime(now, queue.organization.timezone)}</strong>
          </div>
          <div className="display-controls">
            <button
              className={displaySound ? "sound-enabled" : ""}
              disabled={displaySound}
              onClick={enableDisplaySound}
              type="button"
            >
              {displaySound ? "Som ativado ✓" : "Ativar som"}
            </button>
            <button onClick={toggleFullscreen} type="button">
              {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </button>
          </div>
        </header>
      ) : initialMode === "admin" ? (
        <>
          <header className="topbar">
            <Logo organization={queue.organization} />
            <ModeSwitch
              mode={initialMode}
              organizationSlug={organizationSlug}
              authenticated={authenticated}
            />
            <div className="top-meta">
              <span className="status-dot" />
              <span>Sistema online</span>
              <strong>
                {formatClockTime(now, queue.organization.timezone)}
              </strong>
            </div>
          </header>
          <section className="admin-content">
            <div className="admin-heading">
              <p className="kicker">Configuração do sistema</p>
              <h1>Administração</h1>
              <p>
                Defina quantos guichês estarão disponíveis para o atendimento do
                estabelecimento.
              </p>
            </div>

            <div className="admin-grid">
              <section className="admin-setting-card">
                <div className="section-label">
                  <span />
                  Estrutura de atendimento
                </div>
                <h2>Quantidade de guichês</h2>
                <p>
                  Essa configuração atualiza automaticamente a lista disponível
                  para todos os atendentes.
                </p>

                <div className="desk-counter">
                  <button
                    aria-label="Diminuir quantidade de guichês"
                    disabled={busy || deskCountDraft <= 1}
                    onClick={() =>
                      setDeskCountDraft((value) => Math.max(1, value - 1))
                    }
                    type="button"
                  >
                    −
                  </button>
                  <label>
                    <span>Guichês</span>
                    <input
                      aria-label="Quantidade de guichês"
                      max={50}
                      min={1}
                      onChange={(event) =>
                        setDeskCountDraft(
                          Math.min(
                            50,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        )
                      }
                      type="number"
                      value={deskCountDraft}
                    />
                  </label>
                  <button
                    aria-label="Aumentar quantidade de guichês"
                    disabled={busy || deskCountDraft >= 50}
                    onClick={() =>
                      setDeskCountDraft((value) => Math.min(50, value + 1))
                    }
                    type="button"
                  >
                    +
                  </button>
                </div>

                <div className="admin-range-note">
                  Mínimo de 1 e máximo de 50 guichês.
                </div>
                <button
                  className="admin-save-button"
                  disabled={busy || deskCountDraft === queue.desks.length}
                  onClick={saveDeskConfiguration}
                  type="button"
                >
                  {busy ? "Salvando…" : "Salvar configuração"}
                </button>
                {savedMessage ? (
                  <p className="admin-success" role="status">
                    ✓ {savedMessage}
                  </p>
                ) : null}
              </section>

              <section className="admin-preview-card">
                <div className="admin-preview-header">
                  <div>
                    <small>Configuração atual</small>
                    <strong>
                      {queue.desks.length.toString().padStart(2, "0")} guichês
                    </strong>
                  </div>
                  <span>
                    <i /> Sistema sincronizado
                  </span>
                </div>
                <div className="desk-preview-grid">
                  {Array.from(
                    { length: deskCountDraft },
                    (_, index) => index + 1,
                  ).map((number) => (
                    <article
                      className={activeDeskNumbers.has(number) ? "active" : ""}
                      key={number}
                    >
                      <span>Guichê</span>
                      <strong>{number.toString().padStart(2, "0")}</strong>
                      <small>
                        {activeDeskNumbers.has(number)
                          ? "Em atendimento"
                          : "Disponível"}
                      </small>
                    </article>
                  ))}
                </div>
                <div className="admin-help">
                  <strong>Como funciona?</strong>
                  <p>
                    Após salvar, os atendentes verão somente os guichês ativos
                    no seletor. O painel da TV continuará indicando normalmente
                    o guichê de cada chamada.
                  </p>
                </div>
              </section>
            </div>
          </section>
        </>
      ) : (
        <header className="topbar">
          <Logo organization={queue.organization} />
          <ModeSwitch
            mode={initialMode}
            organizationSlug={organizationSlug}
            authenticated={authenticated}
          />
          {initialMode === "client" ? (
            <div className="client-top-actions">
              <div className="top-meta">
                <span className="status-dot" />
                <span>Sistema online</span>
                <strong>
                  {formatClockTime(now, queue.organization.timezone)}
                </strong>
              </div>
              <button
                aria-label={
                  fullscreen ? "Sair da tela cheia" : "Ativar tela cheia"
                }
                aria-pressed={fullscreen}
                className="client-fullscreen-button"
                onClick={toggleFullscreen}
                type="button"
              >
                <span aria-hidden="true">{fullscreen ? "×" : "⛶"}</span>
                <span className="client-fullscreen-label">
                  {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                </span>
              </button>
            </div>
          ) : (
            <div className="top-meta">
              <span className="status-dot" />
              <span>Sistema online</span>
              <strong>
                {formatClockTime(now, queue.organization.timezone)}
              </strong>
            </div>
          )}
        </header>
      )}

      {initialMode === "client" ? (
        <section className="client-content">
          <div className="client-heading">
            <p className="kicker">Bem-vindo à {queue.organization.tradeName}</p>
            <h1>Como podemos ajudar?</h1>
            <p>Toque em uma opção abaixo para retirar sua senha.</p>
          </div>

          <div className="service-grid">
            {queue.services.map((service) => {
              const presentation = servicePresentation(service);
              return (
                <button
                  className="service-card"
                  disabled={busy}
                  key={service.id}
                  onClick={() => createTicket(service.id)}
                  type="button"
                >
                  <span className="service-icon">{presentation.icon}</span>
                  <span className="service-copy">
                    <small>{presentation.eyebrow}</small>
                    <strong>{service.name}</strong>
                    <span>{presentation.description}</span>
                  </span>
                  <span className="card-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              );
            })}
          </div>

          <label className="priority-toggle">
            <input
              checked={priority}
              onChange={(event) => setPriority(event.target.checked)}
              type="checkbox"
            />
            <span className="check-mark">✓</span>
            <span>
              <strong>Atendimento prioritário</strong>
              <small>
                Pessoas com 60+, gestantes, PcD ou com criança de colo
              </small>
            </span>
          </label>

          <div className="client-footer">
            <strong>
              {queue.waiting === 0
                ? "Sem pessoas aguardando"
                : `${queue.waiting} ${queue.waiting === 1 ? "pessoa aguardando" : "pessoas aguardando"}`}
            </strong>
          </div>
        </section>
      ) : initialMode === "display" ? (
        <section className="display-content">
          <div className="display-main">
            <div className="display-eyebrow">
              <span />
              Chamada atual
              <span />
            </div>
            {featuredTicket ? (
              <div
                className="display-featured-call"
                key={`${featuredTicket.id}-${featuredTicket.calledAt}`}
              >
                <span className="display-call-label">Senha</span>
                <strong>{featuredTicket.code}</strong>
                <p>
                  {featuredTicket.service}
                  {featuredTicket.sectorName
                    ? ` · ${featuredTicket.sectorName}`
                    : ""}
                </p>
                {featuredTicket.priority ? (
                  <em>Atendimento prioritário</em>
                ) : null}
                <div className="display-desk">
                  <span>Dirija-se ao</span>
                  <strong>
                    Guichê {featuredTicket.desk?.toString().padStart(2, "0")}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="display-idle">
                <span className="idle-mark">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>Aguardando a próxima chamada</strong>
                <p>Fique atento ao painel e ao aviso sonoro.</p>
              </div>
            )}
          </div>

          <aside className="display-sidebar">
            <div className="previous-title">
              <span>Últimas chamadas</span>
              <small>Senha · Guichê</small>
            </div>
            <div className="previous-list">
              {previousCalls.length ? (
                previousCalls.map((ticket) => (
                  <article key={`${ticket.id}-${ticket.calledAt}`}>
                    <div>
                      <strong>{ticket.code}</strong>
                      <span>{ticket.service}</span>
                    </div>
                    <em>{ticket.desk?.toString().padStart(2, "0")}</em>
                  </article>
                ))
              ) : (
                <p>Nenhuma chamada anterior.</p>
              )}
            </div>

            <div className="display-queue-info">
              <small>Aguardando atendimento</small>
              <strong>{queue.waiting.toString().padStart(2, "0")}</strong>
              <span>
                {queue.waiting === 1 ? "pessoa na fila" : "pessoas na fila"}
              </span>
            </div>
          </aside>

          <footer className="display-footer">
            <span className="display-footer-mark">CR</span>
            <p>
              Tenha seus documentos em mãos. Ao ser chamado, dirija-se ao guichê
              indicado.
            </p>
            <span>Atendimento com respeito e segurança</span>
          </footer>
        </section>
      ) : initialMode === "admin" ? null : (
        <section className="attendant-content">
          <aside className="attendant-sidebar">
            <div>
              <p className="kicker">Painel operacional</p>
              <h1>Atendimento</h1>
              <p>Gerencie a fila e chame a próxima senha.</p>
            </div>

            <label className="desk-select">
              <span>Seu guichê</span>
              <select
                aria-label="Seu guichê"
                disabled={queue.desks.length === 0}
                onChange={(event) => {
                  const nextDeskId = Number(event.target.value);
                  setDeskId(nextDeskId);
                  window.localStorage.setItem(
                    `queue-desk:${queue.organization.slug}`,
                    String(nextDeskId),
                  );
                }}
                value={deskId ?? ""}
              >
                {queue.desks.map((desk) => (
                  <option key={desk.id} value={desk.id}>
                    {desk.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedDesk ? (
              <div className="desk-sector-summary">
                <small>Setor do guichê</small>
                <strong>{selectedDesk.sectorName}</strong>
                <span>
                  {eligibleServiceNames.length
                    ? eligibleServiceNames.join(" · ")
                    : "Nenhum serviço configurado"}
                </span>
              </div>
            ) : null}

            <div className="queue-stats">
              <article>
                <small>Aguardando</small>
                <strong>
                  {eligibleWaitingTickets.length.toString().padStart(2, "0")}
                </strong>
                <span>compatíveis com o setor</span>
              </article>
              <article>
                <small>Atendidos hoje</small>
                <strong>{queue.served.toString().padStart(2, "0")}</strong>
                <span>finalizados</span>
              </article>
            </div>
          </aside>

          <div className="attendant-main">
            <section className="current-card">
              <div className="section-label">
                <span />
                Atendimento atual
              </div>
              {currentTicket ? (
                <>
                  <div className="current-ticket">
                    <div>
                      <small>Senha</small>
                      <strong>{currentTicket.code}</strong>
                      <span>
                        {currentTicket.service}
                        {currentTicket.sectorName
                          ? ` · ${currentTicket.sectorName}`
                          : ""}
                      </span>
                    </div>
                    <div className="called-at">
                      <small>Chamado às</small>
                      <strong>
                        {formatTime(
                          currentTicket.calledAt,
                          queue.organization.timezone,
                        )}
                      </strong>
                    </div>
                  </div>
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        sendAction({ action: "recall", id: currentTicket.id })
                      }
                      type="button"
                    >
                      ↻ Chamar novamente
                    </button>
                    <button
                      className="ghost-button danger"
                      disabled={busy}
                      onClick={() =>
                        sendAction({ action: "no_show", id: currentTicket.id })
                      }
                      type="button"
                    >
                      Não compareceu
                    </button>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() =>
                        sendAction({ action: "finish", id: currentTicket.id })
                      }
                      type="button"
                    >
                      Finalizar atendimento ✓
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-current">
                  <span>✓</span>
                  <div>
                    <strong>Guichê disponível</strong>
                    <p>Chame a próxima pessoa para iniciar o atendimento.</p>
                  </div>
                  <button
                    className="primary-button"
                    disabled={
                      busy || eligibleWaitingTickets.length === 0 || !deskId
                    }
                    onClick={() => sendAction({ action: "call_next", deskId })}
                    type="button"
                  >
                    {eligibleWaitingTickets.length
                      ? "Chamar próxima senha →"
                      : "Fila do setor vazia"}
                  </button>
                </div>
              )}
            </section>

            <section className="queue-card">
              <div className="queue-header">
                <div>
                  <div className="section-label">
                    <span />
                    Próximos da fila
                  </div>
                  <p>Ordem automática com prioridade legal.</p>
                </div>
                <button
                  aria-label="Atualizar fila"
                  className="refresh-button"
                  onClick={() => loadQueue()}
                  type="button"
                >
                  ↻
                </button>
              </div>
              <div className="queue-list">
                {loading ? (
                  <p className="queue-empty">Atualizando a fila…</p>
                ) : eligibleWaitingTickets.length ? (
                  eligibleWaitingTickets.slice(0, 6).map((ticket, index) => (
                    <article className="queue-item" key={ticket.id}>
                      <span className="position">{index + 1}</span>
                      <div className="ticket-code">
                        <strong>{ticket.code}</strong>
                        {ticket.priority ? <em>Prioritário</em> : null}
                      </div>
                      <span className="ticket-service">{ticket.service}</span>
                      <span className="ticket-time">
                        {formatTime(
                          ticket.createdAt,
                          queue.organization.timezone,
                        )}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="queue-empty">
                    Nenhuma senha compatível com este setor.
                  </p>
                )}
              </div>
            </section>

            {recentTickets.length ? (
              <section className="recent-strip">
                <span>Últimos atendidos</span>
                {recentTickets.map((ticket) => (
                  <strong key={ticket.id}>{ticket.code}</strong>
                ))}
              </section>
            ) : null}
          </div>
        </section>
      )}

      {error ? (
        <div className="error-toast" role="alert">
          <span>!</span>
          {error}
          <button onClick={() => setError("")} type="button">
            ×
          </button>
        </div>
      ) : null}

      {createdTicket ? (
        <div aria-hidden="true" className="ticket-print-layer">
          <div className="ticket-paper">
            <Logo organization={queue.organization} />
            <p className="ticket-print-date">
              <span>Data/Hora</span>
              <strong>
                {formatTicketDate(
                  createdTicket.createdAt,
                  queue.organization.timezone,
                )}
              </strong>
            </p>
            <p>Sua senha é</p>
            <strong className="printed-code">{createdTicket.code}</strong>
            <span className="printed-service">{createdTicket.service}</span>
            {createdTicket.priority ? <em>Atendimento prioritário</em> : null}
            <p className="ticket-note">
              Aguarde sua senha aparecer no painel e fique atento à chamada.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
