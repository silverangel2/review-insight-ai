import fs from "fs";
import path from "path";

let localEnvCache: Record<string, string> | null = null;

function cleanEnvValue(value: string | undefined): string {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function readLocalEnvFile(): Record<string, string> {
  if (localEnvCache) return localEnvCache;
  localEnvCache = {};

  if (process.env.NODE_ENV === "production") return localEnvCache;

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return localEnvCache;

  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = cleanEnvValue(trimmed.slice(index + 1));
    if (key) localEnvCache[key] = value;
  }

  return localEnvCache;
}

export function serverEnv(name: string): string {
  const direct = cleanEnvValue(process.env[name]);
  if (direct) return direct;
  return cleanEnvValue(readLocalEnvFile()[name]);
}

export function serverEnvFlag(name: string): boolean {
  const value = serverEnv(name).toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}
