import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";
import { normalizePreferences, type EmailPreferences, type OptionalCategory } from "@/lib/emailPreferences";

// Table email_preferences (migration file only). When missing, defaults apply and nothing is stored.
export async function readPreferenceRow(email: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await supabaseFetch(`/rest/v1/email_preferences?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*&limit=1`, { method: "GET" });
    if (!res.ok) return null;
    return ((await res.json()) as Record<string, unknown>[])[0] || null;
  } catch { return null; }
}
export async function getPreferences(email: string): Promise<EmailPreferences> {
  return normalizePreferences(await readPreferenceRow(email));
}
export async function savePreferences(email: string, patch: Partial<EmailPreferences> & Record<string, unknown>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await supabaseFetch("/rest/v1/email_preferences?on_conflict=email", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ email: email.toLowerCase(), ...patch, updated_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch { return false; }
}
export async function categoryAllowed(email: string, category: OptionalCategory) {
  return (await getPreferences(email))[category];
}
