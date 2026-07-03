"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoginForm } from "@/components/LoginForm";

function readRecoveryParams() {
  if (typeof window === "undefined") {
    return { accessToken: "", error: "" };
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const accessToken = hashParams.get("access_token") || queryParams.get("access_token") || "";
  const error =
    hashParams.get("error_description") ||
    queryParams.get("error_description") ||
    hashParams.get("error") ||
    queryParams.get("error") ||
    "";

  return { accessToken, error };
}

export function PasswordResetCompleteForm() {
  const [accessToken, setAccessToken] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = readRecoveryParams();
    setAccessToken(params.accessToken);
    setTokenError(params.error);

    if (params.accessToken || params.error) {
      window.history.replaceState({}, "", "/auth/reset-password");
    }
  }, []);

  const canSubmit = useMemo(
    () => accessToken && password.length >= 8 && password === confirmPassword && !submitting,
    [accessToken, confirmPassword, password, submitting]
  );

  async function submit() {
    if (!accessToken || submitting) return;

    setNotice("");
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error || "Password update failed.");
        return;
      }

      setNotice("Password updated. You can now log in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Password update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!accessToken) {
    return (
      <div className="grid gap-5">
        {tokenError ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {tokenError}
          </div>
        ) : null}
        <LoginForm initialMode="reset" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">Secure reset</p>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">Choose a new password</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        This reset link is one-time use. After the password is updated, sign in again with the new password.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-ink dark:text-white">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-line bg-blue-50 px-4 py-3 outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-ink dark:text-white">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="rounded-xl border border-line bg-blue-50 px-4 py-3 outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900"
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>
        ) : null}

        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {notice}{" "}
            <Link href="/login" className="underline">
              Go to login
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="rounded-xl bg-ink px-5 py-4 font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          {submitting ? "Updating password..." : "Update password"}
        </button>
      </div>
    </section>
  );
}
