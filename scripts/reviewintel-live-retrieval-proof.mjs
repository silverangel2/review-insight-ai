// One-shot live retrieval proof (Owner-approved). No auth, no OpenAI, no Firecrawl.
// Runs native retrieval -> shared adjudication -> deterministic scoring with dev capture (HTML saved).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
delete process.env.FIRECRAWL_API_KEY; delete process.env.OPENAI_API_KEY;
process.env.NODE_ENV = 'development';
const require = createRequire(process.cwd() + '/x.js');
const jiti = require('jiti')(process.cwd(), { alias: { '@': process.cwd() }, cache: false });
const cap = jiti('./lib/devScanCapture.ts'), nat = jiti('./lib/nativeReviewRetrieval.ts');
const adj = jiti('./lib/reviewEvidenceAdjudication.ts'), det = jiti('./lib/reviewEvidenceDeterminism.ts');
const inputs = JSON.parse(readFileSync(process.argv[2]));
const scanId = process.argv[3];
const hosts = {}; let openAiCalls = 0; const realFetch = globalThis.fetch;
globalThis.fetch = (url, init) => { const h = new URL(String(url)).hostname; hosts[h] = (hosts[h] || 0) + 1; if (/openai/i.test(h)) openAiCalls += 1; if (/firecrawl|openai/i.test(h)) throw new Error('BLOCKED_PAID_PROVIDER ' + h); return realFetch(url, init); };
const out = await cap.withDevScanCapture(scanId, async () => {
  const o = inputs.adjOpts;
  const r = await nat.runNativeReviewRetrieval({ productTitle: o.productName, brand: o.brand, store: 'Amazon.ca', listingUrl: o.exactListingUrl, politeDelayMs: 400 });
  const corpus = adj.adjudicateReviewEvidence(r.reviews || [], o);
  const result = det.deriveDeterministicEvidenceResult({ ...inputs.evalMeta, acceptedRecords: corpus.acceptedRecords });
  return { r, corpus, result };
});
const { r, corpus, result } = out;
if (openAiCalls !== 0) { console.error('OPENAI_CALLS_NONZERO', openAiCalls); process.exit(3); }
console.log(JSON.stringify({
  openAiCalls, politeFetch: r.politeFetch, headlessRender: r.headlessRender, fetchesByHost: hosts, retrieval: { collected: r.reviewsCollected, pagesFetched: r.fetchedPageUrls, stopReason: r.stopReason },
  accepted: corpus.acceptedRecordCount, rejected: corpus.rejectedRecords.map(x => x.rejectionReason),
  sources: corpus.acceptedRecords.reduce((m, x) => (m[x.independentSourceId] = (m[x.independentSourceId] || 0) + 1, m), {}),
  quotes: corpus.acceptedRecords.slice(0, 5).map(x => ({ url: x.original?.sourceUrl || x.sourceUrl, text: x.body.slice(0, 220) })),
  score: result.buyScore, verdict: result.customerVerdict, value: result.valueForMoney, evidenceState: result.evidenceState,
  strengths: result.strengths.map(s => s.claim + ' x' + s.supportCount), complaints: result.complaints.map(s => s.claim + ' x' + s.supportCount),
}, null, 1));
