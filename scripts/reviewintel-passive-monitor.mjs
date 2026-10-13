#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { operationMonitorSnapshot } from "./reviewintel-operation-snapshot.mjs";

if (process.argv.includes("--captures")) {
  const { monitorCaptures } = await import("./reviewintel-capture-monitor.mjs");
  await monitorCaptures();
  process.exit(0);
}

const localEnv = (() => {
  try {
    return Object.fromEntries(
      fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/))
        .filter(Boolean)
        .map((match) => [match[1], match[2]])
    );
  } catch {
    return {};
  }
})();
const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;
const readyAt = process.env.REVIEWINTEL_MONITOR_READY_AT || new Date().toISOString();
const intervalMs = Math.max(250, Number(process.env.REVIEWINTEL_MONITOR_INTERVAL_MS || 1000));
const timeoutMs = Math.max(30_000, Number(process.env.REVIEWINTEL_MONITOR_TIMEOUT_MS || 15 * 60_000));

if (!baseUrl || !serviceKey) {
  console.error("PASSIVE_MONITOR_ERROR=missing_supabase_runtime_configuration");
  process.exitCode = 2;
} else {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const getJson = async (url) => {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(`supabase_http_${response.status}`);
    return response.json();
  };
  const recordFromOperation = operationMonitorSnapshot;

  const operationUrl = (scanId) => `${baseUrl}/rest/v1/reviewintel_scan_operations?select=*&scan_id=eq.${encodeURIComponent(scanId)}&limit=1`;
  const findNewOperation = async () => {
    const url = `${baseUrl}/rest/v1/reviewintel_scan_operations?select=*&created_at=gte.${encodeURIComponent(readyAt)}&order=created_at.asc&limit=1`;
    const rows = await getJson(url);
    return Array.isArray(rows) ? rows[0] || null : null;
  };

  const run = async () => {
    const deadline = Date.now() + timeoutMs;
    let operation = null;
    let lastError = "";
    while (!operation && Date.now() < deadline) {
      try {
        operation = await findNewOperation();
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      if (!operation) await sleep(intervalMs);
    }
    if (!operation) throw new Error(lastError || "no_new_scan_after_monitor_ready");
    console.log(`NEW_SCAN_CREATED=${operation.scan_id}`);
    while (Date.now() < deadline) {
      let rows;
      try {
        rows = await getJson(operationUrl(operation.scan_id));
      } catch {
        await sleep(intervalMs);
        continue;
      }
      const current = Array.isArray(rows) ? rows[0] : null;
      if (current && ["COMPLETED", "FAILED", "BLOCKED"].includes(String(current.status))) {
        console.log(JSON.stringify(recordFromOperation(current), null, 2));
        return;
      }
      await sleep(intervalMs);
    }
    throw new Error("scan_monitor_timeout");
  };

  run().catch((error) => {
    console.error(`PASSIVE_MONITOR_ERROR=${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
