import { notFound } from "next/navigation";
import { BuyingScoreV2Card } from "@/components/BuyingScoreV2Card";
import { buyingScoreFromReviews, type WrittenReview } from "@/lib/buyingScore";

// Development-only preview of Buying Score v2 states (404 in production).
// Neutral example products and example review text; not real customer data.
const r = (body: string, rating: number, reviewer: string, date: string, sourceUrl = "https://www.example-store.test/p/KX200"): WrittenReview => ({ body, rating, reviewer, date, sourceUrl });

const full = buyingScoreFromReviews({
  marketplace: { rating: 4.4, count: 20000 },
  requestedModel: "KX200",
  reviews: [
    r("Great kettle, boils fast and works well every day.", 5, "A", "2026-09-01"),
    r("Easy to use and reliable so far, happy with it.", 5, "B", "2026-09-03"),
    r("Good value. The short cord is a little annoying.", 4, "C", "2026-09-05"),
    r("Works great, looks nice on the counter.", 5, "D", "2026-09-07"),
    r("Solid, easy to clean, would recommend.", 4, "E", "2026-09-09"),
    r("Fine kettle, does what it says.", 4, "F", "2026-09-11"),
    r("Heats quickly. Good.", 4, "G", "2026-09-13"),
    r("Happy with the purchase, works well.", 5, "H", "2026-09-15"),
    r("Decent, a bit plain but good.", 4, "I", "2026-09-17"),
  ],
});
const provisional = buyingScoreFromReviews({ marketplace: { rating: 4.5, count: 2143 }, reviews: [] });
const safety = buyingScoreFromReviews({
  marketplace: { rating: 4.6, count: 3000 },
  requestedModel: "PB10",
  reviews: [
    r("The charger overheated and melted after a week.", 2, "A", "2026-08-01"),
    ...["Great power bank, reliable and easy to carry.", "Works well, charges my phone twice.", "Love it, good value.", "Excellent build and fast charging.", "Happy with it, works great.", "Good size and recommend it.", "Reliable on trips, great.", "Easy to use and sturdy.", "Perfect for travel, good."]
      .map((b, i) => r(b, 5, `R${i}`, `2026-08-${10 + i}`)),
  ],
});

export default function BuyingScorePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Buying Score v2 (dev preview, example products)</h1>
      <div id="full"><h2 className="mb-2 text-sm font-bold text-slate-500">Example Kettle KX200</h2><BuyingScoreV2Card score={full} /></div>
      <div id="provisional"><h2 className="mb-2 text-sm font-bold text-slate-500">Example Blender BL5</h2><BuyingScoreV2Card score={provisional} /></div>
      <div id="safety"><h2 className="mb-2 text-sm font-bold text-slate-500">Example Power Bank PB10</h2><BuyingScoreV2Card score={safety} /></div>
    </main>
  );
}
