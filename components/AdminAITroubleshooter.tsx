"use client";

import { useState } from "react";

const QUICK_QUESTIONS = [
  "Why can a customer not scan after reset?",
  "What should I check before launch?",
  "Do I have security warnings right now?"
];

export function AdminAITroubleshooter() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion) {
      setError("Ask a question first.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setQuestion(cleanQuestion);

    try {
      const response = await fetch("/api/admin/troubleshooter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Troubleshooter failed.");
      }

      setAnswer(String(data.answer ?? "No answer returned."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Troubleshooter failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            AI troubleshooter
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Ask what to check next
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Private admin helper using diagnostics, service status, and recent security events. It gives steps you can follow without digging through every page.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          placeholder="Ask about signups, scan limits, security warnings, SEO readiness, OpenAI errors, Stripe, Supabase, or launch checks..."
          className="w-full resize-y rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold leading-6 text-ink outline-none transition focus:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
        />

        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void ask(item)}
              disabled={loading}
              className="rounded-full border border-line bg-white px-4 py-2 text-xs font-black text-slate-600 transition hover:border-ocean hover:text-ocean disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            >
              {item}
            </button>
          ))}
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {answer ? (
          <div className="rounded-2xl border border-line bg-mist p-5 text-sm font-semibold leading-7 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
            <pre className="whitespace-pre-wrap font-sans">{answer}</pre>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading || !question.trim()}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:bg-white dark:text-ink"
        >
          {loading ? "Checking..." : "Ask Troubleshooter"}
        </button>
      </div>
    </section>
  );
}
