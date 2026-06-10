"use client";

import { useMemo, useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/trustContent";

const supportTopics = [
  "Product question",
  "Billing or cancellation",
  "Account access",
  "Seller Pro report",
  "Data or privacy request",
  "Bug report"
];

export function SupportContactForm({ defaultTopic = "Product question" }: { defaultTopic?: string }) {
  const [topic, setTopic] = useState(defaultTopic);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState("");

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`ReviewIntel support: ${topic}`);
    const body = encodeURIComponent(
      `Account email: ${email || "Not provided"}\nTopic: ${topic}\n\nMessage:\n${message}\n\nPage: ${
        typeof window !== "undefined" ? window.location.href : ""
      }`
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [email, message, topic]);


  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          topic,
          message,
          page: typeof window !== "undefined" ? window.location.href : ""
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Message failed.");
      }

      setStatus("sent");
      setMessage("");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Message failed.");
    }
  }

  return (
    <form onSubmit={submitMessage} className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Your email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Support topic</span>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            {supportTopics.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-black text-ink dark:text-white">How can we help?</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="mt-2 min-h-36 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          placeholder="Tell us what happened, your plan, and what you need."
        />
      </label>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex justify-center rounded-2xl bg-[linear-gradient(135deg,#2356a3,#08b7a8)] px-6 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {status === "sending" ? "Sending..." : status === "sent" ? "Message Sent" : "Send Message"}
          </button>

          <a
            href={mailtoHref}
            className="inline-flex justify-center rounded-2xl border border-line px-6 py-3 text-sm font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:text-white"
          >
            Open Email Draft
          </a>
        </div>
        <div className="space-y-2 text-sm font-bold text-slate-500 dark:text-slate-400">
          {status === "sent" ? <p className="text-emerald-600 dark:text-emerald-300">Saved. Admin inbox will show this message.</p> : null}
          {status === "failed" ? <p className="text-rose-600 dark:text-rose-300">{error}</p> : null}
          <p>
            Direct email: <a className="text-ocean underline-offset-4 hover:underline dark:text-cyan-300" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </form>
  );
}
