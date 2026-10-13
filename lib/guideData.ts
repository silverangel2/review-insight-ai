import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";
import { buildCategoryGuides, type CategoryGuide } from "@/lib/categoryGuides";

// Aggregated, anonymous: only product-level facts leave this function (no emails/ids).
export const loadCategoryGuides = unstable_cache(async (): Promise<CategoryGuide[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const rows = await supabaseSelect("analyses", "select=product_name,analysis_json&mode=eq.buyer&order=created_at.desc&limit=400");
    return buildCategoryGuides(Array.isArray(rows) ? rows : []);
  } catch { return []; }
}, ["reviewintel-category-guides-v1"], { revalidate: 3600 });
