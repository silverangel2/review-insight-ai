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

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`ReviewIntel support: ${topic}`);
    const body = encodeURIComponent(
      `Account email: ${email || "Not provided"}\nTopic: ${topic}\n\nMessage:\n${message}\n\nPage: ${
        typeof window !== "undefined" ? window.location.href : ""
      }`
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [email, message, topic]);

  return (
    <form className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
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
        <a
          href={mailtoHref}
          className="inline-flex justify-center rounded-2xl bg-[linear-gradient(135deg,#2356a3,#08b7a8)] px-6 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5"
        >
          Open Email Draft
        </a>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          Direct email: <a className="text-ocean underline-offset-4 hover:underline dark:text-cyan-300" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </form>
  );
}
