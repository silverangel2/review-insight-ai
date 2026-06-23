"use client";

import type { SubscriptionPlan, UserRole } from "@/lib/types";

const TELEMETRY_KEY = "reviewintel:admin-local-telemetry";
const DEFAULT_SCAN_COST_USD = 0.012;

export type LocalTelemetryUser = {
  email: string;
  role: UserRole;
  plan: SubscriptionPlan;
  loginCount: number;
  scanCount: number;
  estimatedCostUsd: number;
  lastLoginAt?: string;
  lastScanAt?: string;
};

export type LocalTelemetrySummary = {
  users: LocalTelemetryUser[];
  totalLogins: number;
  totalScans: number;
  totalEstimatedCostUsd: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readRaw(): Record<string, LocalTelemetryUser> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(data: Record<string, LocalTelemetryUser>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("reviewintel:admin-telemetry"));
}

function keyFor(email: string, plan: SubscriptionPlan) {
  return `${email.trim().toLowerCase()}:${plan}`;
}

function fallbackUser(email: string, role: UserRole, plan: SubscriptionPlan): LocalTelemetryUser {
  return {
    email,
    role,
    plan,
    loginCount: 0,
    scanCount: 0,
    estimatedCostUsd: 0
  };
}

export function recordLocalLogin(email: string | undefined, role: UserRole | undefined, plan: SubscriptionPlan | undefined) {
  if (!email || !role || !plan || !canUseStorage()) return;

  const data = readRaw();
  const key = keyFor(email, plan);
  const user = data[key] ?? fallbackUser(email, role, plan);
  data[key] = {
    ...user,
    email,
    role,
    plan,
    loginCount: (user.loginCount ?? 0) + 1,
    lastLoginAt: new Date().toISOString()
  };
  writeRaw(data);
}

export function recordLocalScan(email: string | undefined, role: UserRole | undefined, plan: SubscriptionPlan | undefined, costUsd = DEFAULT_SCAN_COST_USD) {
  if (!email || !role || !plan || !canUseStorage()) return;

  const data = readRaw();
  const key = keyFor(email, plan);
  const user = data[key] ?? fallbackUser(email, role, plan);
  data[key] = {
    ...user,
    email,
    role,
    plan,
    scanCount: (user.scanCount ?? 0) + 1,
    estimatedCostUsd: Number(((user.estimatedCostUsd ?? 0) + costUsd).toFixed(4)),
    lastScanAt: new Date().toISOString()
  };
  writeRaw(data);
}

export function readLocalTelemetry(): LocalTelemetrySummary {
  const users = Object.values(readRaw()).sort((a, b) => (b.scanCount + b.loginCount) - (a.scanCount + a.loginCount));
  return {
    users,
    totalLogins: users.reduce((sum, user) => sum + (user.loginCount ?? 0), 0),
    totalScans: users.reduce((sum, user) => sum + (user.scanCount ?? 0), 0),
    totalEstimatedCostUsd: Number(users.reduce((sum, user) => sum + (user.estimatedCostUsd ?? 0), 0).toFixed(4))
  };
}

export function clearLocalTelemetry() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(TELEMETRY_KEY);
  window.dispatchEvent(new CustomEvent("reviewintel:admin-telemetry"));
}
