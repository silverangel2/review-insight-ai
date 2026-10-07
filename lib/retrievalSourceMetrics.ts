export function uniqueAttemptedHttpSources(values: unknown[]): string[] {
  const seen = new Set<string>();
  const sources: string[] = [];

  for (const value of values) {
    const raw = String(value || "").trim();
    if (!/^https?:\/\//i.test(raw)) continue;

    let normalized = raw;
    try {
      const url = new URL(raw);
      url.hash = "";
      normalized = url.toString();
    } catch {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(normalized);
  }

  return sources;
}
