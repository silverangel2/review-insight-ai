import { createHash } from 'node:crypto';
export type Evidence = { id: string; body: string; sourceUrl: string | null };
export function reviewEvidence(corpus: Record<string, unknown>[]): Evidence[] {
  const seen = new Set<string>();
  return corpus.slice(0,100).flatMap(r => {
    const body = typeof r.body === 'string' ? r.body.trim().slice(0,8000) : '';
    if (!body) return [];
    const id = createHash('sha256').update(body).digest('hex');
    if (seen.has(id)) return []; seen.add(id);
    let sourceUrl: string | null = null;
    try { const u = new URL(String(r.sourceUrl || '')); if (u.protocol === 'https:' && !u.username && !u.password) sourceUrl = u.href; } catch { /* Unknown provenance remains unknown. */ }
    return [{ id, body, sourceUrl }];
  });
}
export function evidenceDigest(reviews: Evidence[]) {
  return createHash('sha256').update(JSON.stringify([...reviews].sort((a,b) => a.id.localeCompare(b.id)))).digest('hex');
}
function text(v: unknown, max: number): string { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error('Invalid text'); return v.trim(); }
export function validateReviewProposal(input: unknown, evidence: Evidence[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected proposal object');
  const b = input as Record<string, unknown>;
  if (Object.keys(b).some(k => !['productKey','evidenceDigest','verdict','assessment','rationale','findings','patternStrength'].includes(k))) throw new Error('Unexpected field; scores/publication flags are not accepted');
  const productKey = text(b.productKey, 240);
  if (!evidence.length) throw new Error('No stored written reviews; insufficient evidence');
  if (b.evidenceDigest !== evidenceDigest(evidence)) throw new Error('Evidence changed; retrieve and analyze the current batch again');
  if (!['Buy','Wait','Skip','Insufficient evidence'].includes(String(b.verdict))) throw new Error('Invalid proposed verdict');
  if (b.assessment !== 'Insufficient evidence') throw new Error('No original published verdict is bound to this evidence batch; comparison assessment must be Insufficient evidence');
  if (!['none','some','strong'].includes(String(b.patternStrength))) throw new Error('Pattern grade required; it is not proof of AI authorship');
  if (!Array.isArray(b.findings) || !b.findings.length || b.findings.length > 30) throw new Error('1–30 cited findings required');
  const byId = new Map(evidence.map(r => [r.id,r]));
  const findings = b.findings.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid finding');
    const f = raw as Record<string, unknown>;
    if (Object.keys(f).some(k => !['claim','citations'].includes(k))) throw new Error('Counts must be derived from citations');
    const claim = text(f.claim, 1000);
    if (!Array.isArray(f.citations) || !f.citations.length || f.citations.length > 100) throw new Error('Finding needs citations');
    const ids = new Set<string>();
    const citations = f.citations.map(rawCitation => {
      const c = rawCitation as Record<string, unknown>;
      if (!c || typeof c !== 'object') throw new Error('Invalid citation');
      const reviewId = text(c.reviewId,64), quote = text(c.quote,500);
      const review = byId.get(reviewId);
      if (!review || !review.body.includes(quote)) throw new Error('Unknown review or unsupported quote');
      if (ids.has(reviewId)) throw new Error('A review cannot count twice in a finding');
      ids.add(reviewId); return { reviewId, quote };
    });
    return { claim, citations, supportingReviewCount: ids.size };
  });
  return { productKey, evidenceDigest: b.evidenceDigest, verdict: b.verdict, assessment: b.assessment, rationale: text(b.rationale,3000), patternStrength: b.patternStrength, findings, writtenReviewCount: evidence.length, aiAuthorshipVerified: false, evidence };
}
