import { AsyncLocalStorage } from "node:async_hooks";
import { noteScanProgressEvent } from "./scanProgress";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

export const DEV_CAPTURE_DIRECTORY = "/private/tmp/reviewintel-replay-captures";
type Capture = { schemaVersion: number; scanId: string; timestamp: string; status: string; events: Array<{ stage: string; data: unknown }> };
type CaptureContext = { capture: Capture; directory: string; pending: Promise<void>; timer?: ReturnType<typeof setTimeout> };
const context = new AsyncLocalStorage<CaptureContext>();
const safeId = (value: string) => /^[a-zA-Z0-9_-]{1,160}$/.test(value);
function sanitize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/api.?key|authorization|cookie|headers|password|secret|email|account.?id|user.?id|costTelemetry/i.test(key)) return undefined;
    if (typeof item === "string" && /^https?:\/\//i.test(item)) {
      try { const url = new URL(item); url.username = ""; url.password = "";
        for (const name of [...url.searchParams.keys()]) if (/token|key|signature|credential|auth|session/i.test(name)) url.searchParams.delete(name);
        return url.toString();
      } catch { return item; }
    }
    return item;
  }));
}
function persist(current: CaptureContext) {
  if (process.env.NODE_ENV !== "development") return current.pending;
  current.pending = current.pending.then(async () => {
    try {
      await mkdir(current.directory, { recursive: true, mode: 0o700 });
      const file = join(current.directory, `${current.capture.scanId}.json`);
      const snapshot = JSON.stringify(current.capture, null, 2) + "\n";
      await writeFile(`${file}.partial`, snapshot, { mode: 0o600 });
      await rename(`${file}.partial`, file);
    } catch { console.warn("REPLAY_CAPTURE_WRITE_FAILED=YES"); }
  });
  return current.pending;
}
function schedule(current: CaptureContext) {
  if (current.timer) return;
  current.timer = setTimeout(() => { current.timer = undefined; void persist(current); }, 100);
}
export function captureStage(stage: string, data: unknown) {
  noteScanProgressEvent(stage, data);
  const current = context.getStore();
  if (!current || process.env.NODE_ENV !== "development") return;
  try { current.capture.events.push({ stage, data: sanitize(typeof data === "function" ? data() : data) }); schedule(current); } catch { /* observation only */ }
}
export function captureScanId(scanId: string) {
  const current = context.getStore();
  if (current && safeId(scanId)) { current.capture.scanId = scanId; }
}
export async function withDevScanCapture<T>(scanId: string, work: () => Promise<T>, directory = DEV_CAPTURE_DIRECTORY): Promise<T> {
  if (process.env.NODE_ENV !== "development" || !safeId(scanId)) return work();
  return context.run({ directory, capture: { schemaVersion: 1, scanId, timestamp: new Date().toISOString(), status: "RUNNING", events: [] }, pending: Promise.resolve() }, async () => {
    // The scan ID supplied by the request is recorded before the first write.
    try { const result = await work(); const current = context.getStore()!; current.capture.status = "COMPLETED"; clearTimeout(current.timer); await persist(current); return result; }
    catch (error) { const current = context.getStore()!; current.capture.status = "FAILED"; clearTimeout(current.timer); await persist(current); throw error; }
  });
}
