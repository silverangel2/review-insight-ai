"use client";

import { useEffect, useMemo, useState } from "react";

type BetaFeedback = {
  id: string;
  email: string;
  role?: string | null;
  plan?: string | null;
  message: string;
  admin_reply?: string | null;
  status?: string | null;
  feedback_type?: string | null;
  survey_key?: string | null;
  survey_number?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  replied_at?: string | null;
};

type BetaProfile = {
  email: string;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  beta_started_at?: string | null;
  beta_expires_at?: string | null;
  beta_original_plan?: string | null;
  beta_original_status?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysLeft(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function planLabel(plan?: string | null) {
  if (plan === "buyer_beta") return "Beta Shopper Premium";
  if (plan === "seller_beta") return "Beta Seller Premium";
  if (plan === "buyer_pro") return "Shopper Premium";
  if (plan === "seller_premium") return "Seller Premium";
  if (plan === "seller_pro") return "Seller Pro";
  return plan || "Unknown";
}

export function AdminBetaPanel() {
  const [messages, setMessages] = useState<BetaFeedback[]>([]);
  const [betaProfiles, setBetaProfiles] = useState<BetaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [isSendingSurvey, setIsSendingSurvey] = useState(false);

  async function loadBetaPanel() {
    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/beta-feedback", { cache: "no-store" });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Could not load beta panel.");
      }

      setMessages(Array.isArray(result?.messages) ? result.messages : []);
      setBetaProfiles(Array.isArray(result?.betaProfiles) ? result.betaProfiles : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load beta panel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBetaPanel();
  }, []);

  const openMessages = useMemo(
    () => messages.filter((message) => !["resolved", "archived"].includes(String(message.status || "open"))),
    [messages]
  );

  async function sendWeeklySurvey(force = false) {
    setIsSendingSurvey(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/beta-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Could not send weekly beta survey.");
      }

      setNotice(`Weekly survey sent to ${result?.sent?.length || 0} beta user(s).`);
      await loadBetaPanel();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send weekly beta survey.");
    } finally {
      setIsSendingSurvey(false);
    }
  }

  async function updateFeedback(id: string, patch: { status?: string; admin_reply?: string }) {
    setNotice(null);

    try {
      const response = await fetch("/api/admin/beta-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Could not update beta feedback.");
      }

      setNotice("Beta feedback updated.");
      await loadBetaPanel();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update beta feedback.");
    }
  }

  return (
    <div className="admin-beta-panel space-y-6">
      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
              Beta command center
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink dark:text-white">Beta Panel</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Monitor beta users, observations, replies, and expiry dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => sendWeeklySurvey(false)}
              disabled={isSendingSurvey}
              className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-ink shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingSurvey ? "Sending..." : "Send Due Weekly Survey"}
            </button>
            <button
              type="button"
              onClick={loadBetaPanel}
              className="rounded-full bg-ink px-4 py-2 text-xs font-black text-white shadow-soft dark:bg-white dark:text-ink"
            >
              Refresh
            </button>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            {notice}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Active beta users</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{betaProfiles.length}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Open observations</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{openMessages.length}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Total feedback</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{messages.length}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-xl font-black text-ink dark:text-white">Active beta users</h2>

        {loading ? (
          <p className="mt-4 text-sm font-bold text-slate-500">Loading beta users...</p>
        ) : betaProfiles.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-mist p-4 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            No active beta users yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {betaProfiles.map((profile) => {
              const remaining = daysLeft(profile.beta_expires_at);

              return (
                <div key={profile.email} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-ink dark:text-white">{profile.name || profile.email}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{profile.email}</p>
                    </div>
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-ink">
                      {planLabel(profile.plan)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                    <p>Started: {formatDate(profile.beta_started_at)}</p>
                    <p>Expires: {formatDate(profile.beta_expires_at)}</p>
                    <p>{remaining === null ? "Timer pending" : `${remaining} day${remaining === 1 ? "" : "s"} left`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-xl font-black text-ink dark:text-white">Beta feedback messages</h2>

        {loading ? (
          <p className="mt-4 text-sm font-bold text-slate-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-mist p-4 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            No beta observations yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {messages.map((message) => {
              const draft = replyDrafts[message.id] ?? message.admin_reply ?? "";

              return (
                <article key={message.id} className="admin-beta-message-card rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-ink dark:text-white">{message.email}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                        {message.feedback_type === "survey" ? `Weekly Survey${message.survey_number ? ` #${message.survey_number}` : ""}` : "Beta Feedback"} • {planLabel(message.plan)} • {message.role || "role unknown"} • {formatDate(message.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-white/10 dark:text-slate-200">
                      {message.status || "open"}
                    </span>
                  </div>

                  <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
                    {message.message}
                  </p>

                  <textarea
                    value={draft}
                    onChange={(event) =>
                      setReplyDrafts((current) => ({
                        ...current,
                        [message.id]: event.target.value
                      }))
                    }
                    rows={3}
                    placeholder="Admin reply / notes..."
                    className="mt-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-950 dark:text-white"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateFeedback(message.id, { admin_reply: draft, status: "replied" })}
                      className="rounded-full bg-ocean px-4 py-2 text-xs font-black text-white"
                    >
                      Save Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFeedback(message.id, { status: "resolved" })}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                    >
                      Mark Resolved
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFeedback(message.id, { status: "archived" })}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white"
                    >
                      Archive
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
