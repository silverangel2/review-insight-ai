type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" ? value as RecordValue : {};
}

export function assertPersistedScan(row: unknown, email: string, scanId: string) {
  const stored = record(row);
  const analysis = record(stored.analysis_json);
  const ids = [stored.scan_id, stored.scanId, analysis.scanId, analysis.scan_id, record(analysis.meta).scanId, record(analysis.result).scanId]
    .filter((value) => typeof value === "string" && value.trim()).map((value) => String(value).trim());
  if (!stored.id || String(stored.profile_email || "").toLowerCase().trim() !== email.toLowerCase().trim()
    || !ids.length || ids.some((id) => id !== scanId)) {
    throw new Error("RESULT_PERSISTENCE_IDENTITY_MISMATCH");
  }
  return stored;
}

// Provider boundaries are injected so completion ordering and failures can be
// exercised offline without substituting the production completion logic.
export async function completeAccountScan(input: {
  email: string;
  scanId: string;
  result: RecordValue;
  save: () => Promise<unknown>;
  read: (id: string) => Promise<unknown>;
  consume: (id: string) => Promise<{ ok?: boolean; quota?: unknown }>;
  finish: (result: RecordValue) => Promise<unknown>;
}) {
  if (!input.email || !input.scanId || input.result.scanId !== input.scanId) throw new Error("RESULT_IDENTITY_REQUIRED");
  const saved = record(await input.save());
  if (!saved.id) throw new Error("RESULT_PERSISTENCE_FAILED");
  const persisted = assertPersistedScan(await input.read(String(saved.id)), input.email, input.scanId);
  if (String(persisted.id) !== String(saved.id)) throw new Error("RESULT_PERSISTENCE_IDENTITY_MISMATCH");
  const usage = await input.consume(String(persisted.id));
  if (usage.ok !== true) throw new Error("SCAN_USAGE_PERSISTENCE_FAILED");
  const completed = {
    ...input.result,
    analysisId: persisted.id,
    createdAt: persisted.created_at,
    quota: usage.quota ?? null,
  };
  const completion = record(await input.finish(completed));
  if (completion.ok !== true) throw new Error("SCAN_COMPLETION_NOT_CONFIRMED");
  return completed;
}
