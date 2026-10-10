import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installOfflineGuard } from '../scripts/reviewintel-offline-guard.mjs';
installOfflineGuard();
const jiti = createRequire(import.meta.url)('jiti')(process.cwd(), { alias: { '@': process.cwd() } });
const { adjudicateReviewEvidence } = jiti('./lib/reviewEvidenceAdjudication.ts');
const { deriveDeterministicEvidenceResult } = jiti('./lib/reviewEvidenceDeterminism.ts');
const { runNativeReviewRetrieval } = jiti('./lib/nativeReviewRetrieval.ts');
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/reviewintel/ringconn-existing-capture-inputs.json'));
const options = fixture.adjudicationArgs[1];
const evaluate = bodies => {
  const corpus = adjudicateReviewEvidence(bodies.map(body=>({body,sourceUrl:options.exactListingUrl,reviewStructureVerified:true})), options);
  return deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,acceptedRecords:corpus.acceptedRecords});
};
const good = i => `My ring works well and is comfortable every day, experience ${i}.`;
const bad = i => `My ring battery failed permanently after normal use, experience ${i}.`;
test('existing RingConn capture rejects only accessory and exposes two battery reports',()=>{
 const corpus=adjudicateReviewEvidence(...fixture.adjudicationArgs);
 assert.equal(corpus.acceptedRecordCount,7);assert.equal(corpus.rejectedRecordCount,1);
 assert.match(corpus.rejectedRecords[0].rejectionReason,/sizing-kit/);
 const result=deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,acceptedRecords:corpus.acceptedRecords});
 assert.equal(result.customerVerdict,'DO NOT BUY YET');assert.equal(result.buyScore,6.1);
 assert.equal(result.deterministicScoringInputs.severeComplaintCount,2);
 assert.equal(result.complaints.find(c=>c.claim==='battery failure or charge retention problems').supportCount,2);
 assert.equal(result.strengths.find(c=>c.claim==='comfortable fit').supportCount,2);
 assert.ok(!result.strengths.some(c=>c.claim==='reliable or durable performance'));
 for(const claim of [...result.strengths,...result.complaints]) {
  assert.equal(claim.supportCount,claim.sourceHashes.length);
  assert.ok(claim.sourceHashes.every(h=>result.acceptedReviewHashes.includes(h)));
  assert.equal(claim.sourceDiversity,1);
 }
 assert.deepEqual(result,deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,acceptedRecords:[...corpus.acceptedRecords].reverse()}));
});
test('policy calibration spans positive, mixed, negative, sparse and severe outliers',()=>{
 assert.equal(evaluate(Array.from({length:10},(_,i)=>good(i))).customerVerdict,'BUY');
 assert.equal(evaluate([...Array.from({length:9},(_,i)=>good(i)),bad(9)]).customerVerdict,'BUY');
 assert.equal(evaluate([...Array.from({length:5},(_,i)=>good(i)),bad(5),bad(6)]).customerVerdict,'DO NOT BUY YET');
 assert.equal(evaluate([...Array.from({length:5},(_,i)=>good(i)),...Array.from({length:5},(_,i)=>bad(i))]).customerVerdict,'AVOID');
 assert.equal(evaluate(Array.from({length:3},(_,i)=>bad(i))).buyScore,null);
 assert.equal(evaluate([...Array.from({length:9},(_,i)=>good(i)),'My ring exploded and burned me during charging.']).customerVerdict,'DO NOT BUY YET');
});
test('marketplace aggregate cannot change score or verdict',()=>{
 const corpus=adjudicateReviewEvidence(...fixture.adjudicationArgs);
 const results=[null,1,5].map(rating=>deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,rating,marketplaceReviewCount:100000,acceptedRecords:corpus.acceptedRecords}));
 assert.equal(new Set(results.map(r=>r.buyScore)).size,1);assert.equal(new Set(results.map(r=>r.customerVerdict)).size,1);
});
test('negation, cleaning, durability and multilingual unknowns stay grounded',()=>{
 const r=evaluate(Array.from({length:6},(_,i)=>`I don't love the app; it is easy to clean but the plastic cracked, experience ${i}.`));
 assert.equal(r.customerVerdict,'AVOID');assert.ok(!r.strengths.some(c=>/use or/.test(c.claim)));
 assert.ok(r.complaints.some(c=>/cracking/.test(c.claim)));
 const unknown=evaluate(Array.from({length:6},(_,i)=>`这是一段真实用户评论，使用体验需要进一步分析 ${i}`));
 assert.equal(unknown.buyScore,null);assert.equal(unknown.customerVerdict,'DO NOT BUY YET');
});
test('accessory mention differs from accessory subject and generation conflict overrides listing',()=>{
 const corpus=adjudicateReviewEvidence([
  {body:'I used the sizing kit first; my ring works well and is comfortable.',sourceUrl:options.exactListingUrl},
  {body:'I love the charger for RingConn Gen 2 Air. It works well.',sourceUrl:options.exactListingUrl},
  {body:'My RingConn Gen 3 Air ring works great.',sourceUrl:options.exactListingUrl},
 ],options);
 assert.equal(corpus.acceptedRecordCount,1);assert.equal(corpus.rejectedRecordCount,2);
});
test('unicode bodies do not collapse and repeated retailer review IDs deduplicate',()=>{
 const records=[{body:'这是第一条用户评价内容，日常使用非常舒适。',reviewId:'one'},{body:'这是另一条用户评价内容，电池使用时间很短。',reviewId:'two'},{body:'这是第一条用户评价内容，日常使用非常舒适。 更新内容',reviewId:'one'}].map(r=>({...r,sourceUrl:options.exactListingUrl,reviewStructureVerified:true}));
 const corpus=adjudicateReviewEvidence(records,options);assert.equal(corpus.acceptedRecordCount,2);assert.equal(corpus.deduplicatedRecordCount,1);
});
test('bounded native retrieval reserves pages for independent retailer and rejects fetched wrong identity',async()=>{
 const old=globalThis.fetch;const requested=[];
 const html=(name,body)=>`<title>${name}</title><script type="application/ld+json">${JSON.stringify({'@type':'Product',name,brand:'RingConn',review:{'@type':'Review',reviewBody:body}})}</script>`;
 globalThis.fetch=async url=>{
  const u=new URL(url);requested.push(u);
  if(/bing|duckduckgo/.test(u.hostname))return new Response('<a href="https://www.bestbuy.com/site/ringconn-gen-2-air/123.p">RingConn Gen 2 Air Smart Ring</a><a href="https://wrong.example/products/ringconn-gen-2-air">RingConn Gen 2 Air Smart Ring</a>');
  if(u.hostname==='www.bestbuy.com')return new Response(html('RingConn Gen 2 Air Smart Ring','My ring is comfortable and works well, independent retailer experience.'));
  if(u.hostname==='wrong.example')return new Response(html('RingConn Gen 3 Air Smart Ring','My ring works great, this is the wrong generation.'));
  return new Response(html('RingConn Gen 2 Air Smart Ring','My ring works well, primary listing review.'));
 };
 try {
  const r=await runNativeReviewRetrieval({productTitle:'RingConn Gen 2 Air Smart Ring',brand:'RingConn',model:'Gen 2 Air',listingUrl:options.exactListingUrl,maxPages:8,maxQueries:1,politeDelayMs:0});
  assert.ok(requested.some(u=>u.hostname==='www.bestbuy.com'));
  assert.ok(r.reviews.some(r=>/independent retailer/.test(r.body)));
  assert.ok(!r.reviews.some(r=>/wrong generation/.test(r.body)));
  assert.ok(r.diagnostics.rejectedCandidates>0);
 } finally {globalThis.fetch=old;}
});
test('captured extraction through adjudication, completion and exact browser storage preserves payload',async()=>{
 const { extractWrittenReviewsFromHtml }=jiti('./lib/reviewCollector.ts');
 const { completeAccountScan }=jiti('./lib/scanCompletion.ts');
 const { saveLatestResult,readLatestResult }=jiti('./lib/resultStorage.ts');
 const { enforceFinalVerdictConsistency }=jiti('./lib/finalVerdictConsistency.ts');
 const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const html=fixture.adjudicationArgs[0].map((r,i)=>`<div data-hook="review" id="R${i}"><span data-hook="review-body">${escape(r.body)}</span></div>`).join('');
 const extracted=extractWrittenReviewsFromHtml(html,options.exactListingUrl);
 const corpus=adjudicateReviewEvidence(extracted,options);
 assert.equal(corpus.acceptedRecordCount,7);assert.equal(corpus.rejectedRecordCount,1);
 const scored=deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,acceptedRecords:corpus.acceptedRecords});
 const scanId=fixture.provenance.scanId,email='owner@example.test';
 const result={...scored,scanId,verdict:scored.customerVerdict,product:{name:'RingConn Gen 2 Air'},meta:{scanId,audience:'buyer'},evidenceAdjudication:corpus};
 const order=[];let row;
 const completed=await completeAccountScan({email,scanId,result,save:async()=>{order.push('save');row={id:'offline-analysis',profile_email:email,analysis_json:result};return row;},read:async()=>{order.push('read');return row;},consume:async()=>{order.push('consume');return {ok:true};},finish:async value=>{order.push('finish');assert.equal(value.scanId,scanId);return {ok:true};}});
 assert.deepEqual(order,['save','read','consume','finish']);
 const makeStorage=()=>{const entries=new Map();return {setItem:(k,v)=>entries.set(k,v),getItem:k=>entries.get(k)??null,removeItem:k=>entries.delete(k)};};
 const previous=globalThis.window;globalThis.window={sessionStorage:makeStorage(),localStorage:makeStorage()};
 const account={email,role:'buyer',plan:'free_buyer'};
 try {assert.equal(saveLatestResult(completed,account),true);const loaded=readLatestResult(account,{scanId});assert.deepEqual(loaded,JSON.parse(JSON.stringify(completed)));assert.equal(readLatestResult(account,{scanId:'wrong-scan'}),null);assert.equal(readLatestResult({...account,email:'other@example.test'},{scanId}),null);assert.deepEqual(enforceFinalVerdictConsistency(loaded),loaded);}finally{globalThis.window=previous;}
});
test('a canonical BUY never fabricates value or inflates the evidence score at display time',()=>{
 const { enforceFinalVerdictConsistency }=jiti('./lib/finalVerdictConsistency.ts');
 const result=evaluate([...Array.from({length:9},(_,i)=>good(i)),bad(9)]);
 assert.equal(result.valueForMoney,'Unknown');assert.equal(result.customerVerdict,'BUY');assert.equal(result.buyScore,7.2);
 assert.deepEqual(enforceFinalVerdictConsistency({...result,verdict:result.customerVerdict}),{...result,verdict:result.customerVerdict});
});
test('French negation cannot normalize into praise and unrelated praise cannot bless advertised durability',()=>{
 const r=evaluate(Array.from({length:6},(_,i)=>`Ma bague n'est pas très confortable et ne fonctionne pas, experience ${i}.`));
 assert.notEqual(r.customerVerdict,'BUY');assert.ok(!r.strengths.some(c=>c.claim==='comfortable fit'));
 const advertised=evaluate(Array.from({length:6},(_,i)=>`My ring works well and is supposed to be durable, experience ${i}.`));
 assert.ok(!advertised.strengths.some(c=>/durable|quality/.test(c.claim)));
});
test('real research orchestration keeps full-body differences and the accessory rejection ledger',async()=>{
 const { POST }=jiti('./app/api/dev/reviewintel-diagnostic/route.ts');
 const oldFetch=globalThis.fetch;
 const oldSearch=process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED,oldDelay=process.env.REVIEWINTEL_RETRIEVAL_DELAY_MS;
 process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED='false';process.env.REVIEWINTEL_RETRIEVAL_DELAY_MS='0';
 const prefix='I use my ring daily and it is comfortable. '+Array.from({length:85},()=> 'context').join(' ');
 const reviews=[...Array.from({length:6},(_,i)=>({'@type':'Review',reviewBody:`${prefix} My independent experience ends with observation ${i}.`})),{'@type':'Review',reviewBody:'Je trouve ce kit de tailles vraiment utile pour tester les tailles.'}];
 const html=`<title>RingConn Gen 2 Air Smart Ring</title><script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'RingConn Gen 2 Air Smart Ring',brand:'RingConn',model:'Gen 2 Air',review:reviews})}</script>`;
 globalThis.fetch=async url=>{
  const u=new URL(url);
  assert.doesNotMatch(u.hostname,/openai|supabase|firecrawl/);
  if(u.hostname==='www.amazon.ca'&&u.pathname.includes('/dp/'))return new Response(html);
  return new Response('Access denied',{status:403});
 };
 try {
  const response=await POST(new Request('http://localhost/api/dev/reviewintel-diagnostic',{method:'POST',body:JSON.stringify({productName:'RingConn Gen 2 Air Smart Ring',brand:'RingConn',model:'Gen 2 Air',store:'Amazon.ca',listingUrl:options.exactListingUrl})}));
  const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.acceptedExactProductReviews,6);assert.equal(result.rejectedReviews,1);
  assert.equal(result.cost.openAiCalls,0);assert.equal(result.cost.firecrawlCalls,0);assert.equal(result.analysisReceivedAcceptedCorpus,true);
 }finally{globalThis.fetch=oldFetch;if(oldSearch===undefined)delete process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED;else process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED=oldSearch;if(oldDelay===undefined)delete process.env.REVIEWINTEL_RETRIEVAL_DELAY_MS;else process.env.REVIEWINTEL_RETRIEVAL_DELAY_MS=oldDelay;}
});
test('public pagination follows only advertised same-product links',()=>{
 const { discoverPublicReviewFollowups }=jiti('./lib/reviewRetrievalPolicy.ts');
 const base='https://manufacturer.example/products/ring';
 const urls=discoverPublicReviewFollowups('<a href="/products/ring/reviews?page=2">Next reviews</a><a href="/products/other/reviews?page=2">Next reviews</a><a href="https://external.example/reviews">Reviews</a><a href="/login">Next</a>',base);
 assert.deepEqual(urls,['https://manufacturer.example/products/ring/reviews?page=2']);
});
test('unsourced written claims cannot become accepted evidence or a buying decision',()=>{
 const corpus=adjudicateReviewEvidence(Array.from({length:6},(_,i)=>({body:`My RingConn Gen 2 Air works great, experience ${i}.`})),options);
 assert.equal(corpus.acceptedRecordCount,0);assert.ok(corpus.rejectedRecords.every(r=>/source URL/.test(r.rejectionReason)));
 const result=deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,acceptedRecords:corpus.acceptedRecords});assert.equal(result.buyScore,null);assert.equal(result.customerVerdict,'DO NOT BUY YET');
});
