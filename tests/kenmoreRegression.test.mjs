import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import test from 'node:test';
const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url).pathname;
const jiti = require('jiti')(root, { alias: { '@': root } });
const { extractProductIdentityTokenRoles } = jiti('./lib/productIdentityTokens.ts');
const { buildRetrievalQueries, normalizeProductUrl } = jiti('./lib/productUrlRetrieval.ts');
const { buildProductRetryQueries, verifyProductCandidate, prepareCandidateForVerification } = jiti('./lib/productSearchVerifier.ts');
const { runNativeReviewRetrieval, nativeSourceMatchesProduct } = jiti('./lib/nativeReviewRetrieval.ts');
const { extractWrittenReviewsFromHtml } = jiti('./lib/reviewCollector.ts');
const fixture = {
  scanId: 'scan_55695f6d-1762-4d31-98de-81c3c9ff5cb7',
  brand: 'Kenmore', productName: 'Kenmore 7.0 cu. ft. Front Load Electric Dryer',
  color: 'White', store: 'Amazon.ca', price: 999, rating: 4, reviewCount: 92,
};
// An explicitly synthetic URL tests canonicalization; it is never reported as a discovered listing.
const url = 'https://www.amazon.ca/dp/B0TEST0001';

test('A-E: failed scan preserves brand/family/capacity/color and excludes mutable metadata', () => {
  const roles = extractProductIdentityTokenRoles(fixture);
  assert.equal(roles.primaryBrand, 'kenmore');
  assert.deepEqual(roles.capacityOrSize, ['7.0 cu. ft.']);
  assert.deepEqual(roles.colors, ['white']);
  assert.ok(roles.primaryProductFamily.includes('dryer'));
  assert.deepEqual(roles.primaryModels, []);
  for (const builder of [buildRetrievalQueries, buildProductRetryQueries]) {
    const queries = builder(fixture);
    assert.equal(new Set(queries).size, queries.length);
    assert.ok(queries.every(q => /Kenmore/i.test(q) && /dryer/i.test(q)));
    assert.ok(queries.some(q => /7\.0.*cu.*ft/i.test(q)));
    assert.ok(queries.every(q => !/999|4\.0|\b92\b|reviews|rating|price/i.test(q)));
  }
});
for (const brand of ['Whirlpool', 'Maytag', 'Frigidaire']) {
  test(`F-H: ${brand} candidate is rejected without fetching`, async () => {
    const previous = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('should not fetch wrong brand'); };
    try {
      const candidate = { url, title: `${brand} 7.0 cu. ft. Front Load Electric Dryer White` };
      const prepared = await prepareCandidateForVerification(fixture, candidate);
      assert.equal(verifyProductCandidate(fixture, prepared).canCollectReviews, false);
      assert.equal(calls, 0);
      assert.equal(nativeSourceMatchesProduct({ productTitle: fixture.productName, brand: fixture.brand, store: fixture.store }, { url: 'https://www.bestbuy.ca/en-ca/product/wrong/123', label: candidate.title }), false);
    } finally { globalThis.fetch = previous; }
  });
}

test('I-L: Amazon redirects canonicalize, ASIN is captured, Tier B tolerates mutable drift', () => {
  for (const raw of [
    `${url}?tag=tracking`,
    url.replace('/dp/', '/some-title/dp/'),
    url.replace('/dp/', '/gp/product/'),
    `https://www.bing.com/ck/a?u=a1${Buffer.from(url+'?tag=tracking').toString('base64url')}`,
    `https://duckduckgo.com/l/?uddg=${encodeURIComponent(url+'?tag=tracking')}`,
  ]) assert.equal(normalizeProductUrl(raw), url);
  const result = verifyProductCandidate(fixture, {
    url: `${url}?tag=tracking`, title: fixture.productName + ' White',
    enrichmentAttempted: true, enrichmentSucceeded: false,
    price: 799, rating: 3.8, reviewCount: 120,
  });
  assert.equal(result.canCollectReviews, true);
  assert.equal(result.verifiedListingUrl, url);
  assert.equal(result.canonicalIdentifier, 'B0TEST0001');
  assert.match(result.verifierReasons.join(' '), /Tier B/);
  for (const title of ['Generic Electric Dryer', fixture.productName.replace('7.0', '8.0'), fixture.productName+' bundle', fixture.productName+' Black']) {
    assert.equal(verifyProductCandidate(fixture, { url, title }).canCollectReviews, false);
  }
});

test('M: native retrieval starts with the verified listing and rejects conflicting discovery links', async () => {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (value) => { requests.push(String(value)); return new Response('Access denied', { status: 403 }); };
  try {
    const result = await runNativeReviewRetrieval({
      productTitle: fixture.productName, brand: fixture.brand, store: fixture.store,
      listingUrl: url, maxQueries: 1, maxPages: 2, politeDelayMs: 0,
      sourceLinks: [{url:'https://www.bestbuy.ca/en-ca/product/wrong/123', label:'Whirlpool 7.0 cu. ft. Front Load Electric Dryer'}],
    });
    assert.equal(requests[0], url);
    assert.equal(result.attempted, true);
    assert.equal(result.reviewsCollected, 0);
    assert.equal(result.diagnostics.fetchedPageUrls.length, 0);
    assert.ok(result.diagnostics.attemptedPages > 0);
    assert.equal(requests.some(value => value.includes('bestbuy')), false);
  } finally { globalThis.fetch = previous; }
});

test('N-P: metadata cannot become written reviews; analysis uses accepted corpus; Firecrawl remains unreachable', () => {
  assert.deepEqual(extractWrittenReviewsFromHtml('<p>Kenmore electric dryer has 92 reviews. Excellent durability and good value for money.</p>', url), []);
  const evidence = fs.readFileSync(new URL('../lib/reviewEvidence.ts', import.meta.url), 'utf8');
  assert.match(evidence, /reviewsFound: commentsAnalyzed/);
  assert.match(evidence, /reviewsFound: actualCommentsAnalyzed/);
  const diagnostic = fs.readFileSync(new URL('../app/api/dev/reviewintel-diagnostic/route.ts', import.meta.url), 'utf8');
  assert.match(diagnostic, /acceptedRecords = adjudication\?\.acceptedRecords/);
  assert.match(diagnostic, /deriveDeterministicEvidenceResult\(\{\s*acceptedRecords/);
  assert.match(diagnostic, /corpusHash: deterministic\.acceptedCorpusHash/);
  assert.doesNotMatch(evidence, /(?:await|return)\s+runFirecrawlFallback\(/);
});
