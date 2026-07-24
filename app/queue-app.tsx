"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "client" | "attendant";
type Service = "Atendimento geral" | "Certidões" | "Registro e reconhecimento";
type TicketStatus = "waiting" | "called" | "finished" | "no_show";

type Ticket = {
  id: number;
  code: string;
  service: Service;
  priority: number;
  status: TicketStatus;
  desk: number | null;
  createdAt: string;
  calledAt: string | null;
};

type QueuePayload = {
  tickets: Ticket[];
  waiting: number;
  served: number;
  averageMinutes: number;
};

const SERVICES: Array<{
  name: Service;
  eyebrow: string;
  description: string;
  icon: string;
}> = [
  {
    name: "Atendimento geral",
    eyebrow: "Serviços diversos",
    description: "Dúvidas, orientações e outros serviços",
    icon: "A",
  },
  {
    name: "Certidões",
    eyebrow: "2ª via e consultas",
    description: "Nascimento, casamento e óbito",
    icon: "C",
  },
  {
    name: "Registro e reconhecimento",
    eyebrow: "Documentos",
    description: "Firmas, autenticações e registros",
    icon: "R",
  },
];

const EMPTY_QUEUE: QueuePayload = {
  tickets: [],
  waiting: 0,
  served: 0,
  averageMinutes: 0,
};

function formatTime(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function Logo() {
  return (
    <div className="brand" aria-label="Cartório Alta Serra">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <strong>Alta Serra</strong>
        <small>Cartório &amp; Registro Civil</small>
      </span>
    </div>
  );
}

function ModeSwitch({ mode }: { mode: Mode }) {
  return (
    <nav className="mode-switch" aria-label="Selecionar tela">
      <a className={mode === "client" ? "active" : ""} href="/cliente">
        Retirar senha
      </a>
      <a className={mode === "attendant" ? "active" : ""} href="/atendente">
        Área do atendente
      </a>
    </nav>
  );
}

export function QueueApp({ initialMode }: { initialMode: Mode }) {
  const [queue, setQueue] = useState<QueuePayload>(EMPTY_QUEUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [priority, setPriority] = useState(false);
  const [desk, setDesk] = useState(1);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  const loadQueue = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      const data = (await response.json()) as QueuePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a fila.");
      setQueue(data);
      setError("");
    } catch {
      setError("Não foi possível conectar à fila. Tente novamente.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const refresh = window.setInterval(() => loadQueue(true), 3500);
    const clock = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [loadQueue]);

  async function sendAction(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ticket?: Ticket; error?: string };
      if (!response.ok) throw new Error(data.error || "Ação não concluída.");
      await loadQueue(true);
      setError("");
      return data.ticket ?? null;
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Ação não concluída."
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createTicket(service: Service) {
    const ticket = await sendAction({ action: "create", service, priority });
    if (ticket) setCreatedTicket(ticket);
  }

  const waitingTickets = useMemo(
    () => queue.tickets.filter((ticket) => ticket.status === "waiting"),
    [queue.tickets]
  );
  const currentTicket = useMemo(
    () =>
      queue.tickets.find(
        (ticket) => ticket.status === "called" && ticket.desk === desk
      ) ?? null,
    [queue.tickets, desk]
  );
  const recentTickets = useMemo(
    () =>
      queue.tickets
        .filter((ticket) => ticket.status === "finished")
        .slice(0, 4),
    [queue.tickets]
  );
  const peopleAhead = createdTicket
    ? queue.tickets.filter(
        (ticket) =>
          ticket.status === "waiting" &&
          ticket.id < createdTicket.id &&
          (ticket.priority >= createdTicket.priority || createdTicket.priority === 0)
      ).length
    : 0;

  return (
    <main className={`app-shell ${initialMode}`}>
      <header className="topbar">
        <Logo />
        <ModeSwitch mode={initialMode} />
        <div className="top-meta">
          <span className="status-dot" />
          <span>Sistema online</span>
          <strong>
            {now.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
        </div>
      </header>

      {initialMode === "client" ? (
        <section className="client-content">
          <div className="client-heading">
            <p className="kicker">Bem-vindo ao Cartório Alta Serra</p>
            <h1>Como podemos ajudar?</h1>
            <p>Toque em uma opção abaixo para retirar sua senha.</p>
          </div>

          <div className="service-grid">
            {SERVICES.map((service) => (
              <button
                className="service-card"
                disabled={busy}
                key={service.name}
                onClick={() => createTicket(service.name)}
                type="button"
              >
                <span className="service-icon">{service.icon}</span>
                <span className="service-copy">
                  <small>{service.eyebrow}</small>
                  <strong>{service.name}</strong>
                  <span>{service.description}</span>
                </span>
                <span className="card-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
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
            <span>Tempo estimado de espera</span>
            <strong>
              {queue.waiting === 0 ? "Sem fila no momento" : `~${Math.max(5, queue.waiting * 7)} min`}
            </strong>
            <i />
            <span>{queue.waiting} pessoas aguardando</span>
          </div>
        </section>
      ) : (
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
                onChange={(event) => setDesk(Number(event.target.value))}
                value={desk}
              >
                {[1, 2, 3, 4].map((number) => (
                  <option key={number} value={number}>
                    Guichê {number.toString().padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>

            <div className="queue-stats">
              <article>
                <small>Aguardando</small>
                <strong>{queue.waiting.toString().padStart(2, "0")}</strong>
                <span>na fila agora</span>
              </article>
              <article>
                <small>Atendidos hoje</small>
                <strong>{queue.served.toString().padStart(2, "0")}</strong>
                <span>finalizados</span>
              </article>
              <article className="wide">
                <small>Tempo médio</small>
                <strong>{queue.averageMinutes || 0} min</strong>
                <span>por atendimento</span>
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
                      <span>{currentTicket.service}</span>
                    </div>
                    <div className="called-at">
                      <small>Chamado às</small>
                      <strong>{formatTime(currentTicket.calledAt)}</strong>
                    </div>
                  </div>
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => sendAction({ action: "recall", id: currentTicket.id })}
                      type="button"
                    >
                      ↻ Chamar novamente
                    </button>
                    <button
                      className="ghost-button danger"
                      disabled={busy}
                      onClick={() => sendAction({ action: "no_show", id: currentTicket.id })}
                      type="button"
                    >
                      Não compareceu
                    </button>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => sendAction({ action: "finish", id: currentTicket.id })}
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
                    disabled={busy || waitingTickets.length === 0}
                    onClick={() => sendAction({ action: "call_next", desk })}
                    type="button"
                  >
                    {waitingTickets.length ? "Chamar próxima senha →" : "Fila vazia"}
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
                ) : waitingTickets.length ? (
                  waitingTickets.slice(0, 6).map((ticket, index) => (
                    <article className="queue-item" key={ticket.id}>
                      <span className="position">{index + 1}</span>
                      <div className="ticket-code">
                        <strong>{ticket.code}</strong>
                        {ticket.priority ? <em>Prioritário</em> : null}
                      </div>
                      <span className="ticket-service">{ticket.service}</span>
                      <span className="ticket-time">{formatTime(ticket.createdAt)}</span>
                    </article>
                  ))
                ) : (
                  <p className="queue-empty">Nenhuma senha aguardando no momento.</p>
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
        <div className="ticket-modal" role="dialog" aria-modal="true">
          <div className="ticket-paper">
            <button
              aria-label="Fechar comprovante"
              className="close-modal"
              onClick={() => setCreatedTicket(null)}
              type="button"
            >
              ×
            </button>
            <Logo />
            <p>Sua senha é</p>
            <strong className="printed-code">{createdTicket.code}</strong>
            <span className="printed-service">{createdTicket.service}</span>
            {createdTicket.priority ? <em>Atendimento prioritário</em> : null}
            <div className="ticket-divider" />
            <div className="ticket-details">
              <span>
                Pessoas à frente <strong>{peopleAhead}</strong>
              </span>
              <span>
                Previsão <strong>~{Math.max(5, (peopleAhead + 1) * 7)} min</strong>
              </span>
            </div>
            <p className="ticket-note">
              Aguarde sua senha aparecer no painel e fique atento à chamada.
            </p>
            <button className="print-button" onClick={() => window.print()} type="button">
              Imprimir comprovante
            </button>
            <button className="finish-link" onClick={() => setCreatedTicket(null)} type="button">
              Concluir
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
