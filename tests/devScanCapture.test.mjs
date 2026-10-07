import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { replayScan } from '../scripts/reviewintel-replay-scan.mjs';
import { captureMonitorSnapshot, monitorCaptures } from '../scripts/reviewintel-capture-monitor.mjs';
const require=createRequire(import.meta.url);
const jiti=require('jiti')(new URL('../',import.meta.url).pathname,{alias:{'@':new URL('../',import.meta.url).pathname}});
const {withDevScanCapture,captureStage}=jiti('./lib/devScanCapture.ts');
const production={...jiti('./lib/productSearchVerifier.ts'),...jiti('./lib/reviewEvidenceAdjudication.ts'),...jiti('./lib/reviewEvidenceDeterminism.ts'),...jiti('./lib/productIdentityTokens.ts'),...jiti('./lib/nativeReviewRetrieval.ts')};
const {ScanCostTelemetry}=jiti('./lib/scanCostTelemetry.ts');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/reviewintel-captured/takki.json',import.meta.url)));
const directory=mkdtempSync('/private/tmp/reviewintel-capture-test-');
const scanId='capture-regression';
let expected,capture;
test('development captures complete real pipeline without extra provider calls',async()=>{
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='development';let io=0;
 const previousFetch=globalThis.fetch;globalThis.fetch=()=>{io++;throw Error('Unexpected provider I/O');};
 try {
 await withDevScanCapture(scanId,async()=>{
  const cost=new ScanCostTelemetry();const job={...fixture.product,scanId};
  captureStage('identity',job);
  const verified=production.verifyProductCandidate(job,fixture.candidates[0]);
  assert.equal(production.nativeSourceMatchesProduct({productTitle:job.productName,brand:job.brand,store:job.store,listingUrl:verified.verifiedListingUrl},{url:fixture.candidates[0].url,label:fixture.candidates[0].title}),true);
  captureStage('page',{sourceUrl:fixture.candidates[0].url,httpStatus:200,blockedOrChallenged:false,page:1,records:[]});
  captureStage('extraction',{sourceUrl:fixture.candidates[0].url,records:fixture.rawRecords.map(r=>({...r,...production.normalizeReviewCandidate(r)}))});
  captureStage('page',{sourceUrl:fixture.candidates[0].url,httpStatus:403,blockedOrChallenged:true,page:2,records:[]});
  const records=[...fixture.rawRecords,{body:'Explicitly synthetic blocked-page rejection test',sourceUrl:fixture.candidates[0].url,blockedOrChallenged:true}];
  const corpus=production.adjudicateReviewEvidence(records,{productName:job.productName,brand:job.brand,exactListingAccepted:verified.canCollectReviews,exactListingUrl:verified.verifiedListingUrl,exactListingTitle:fixture.candidates[0].title});
  assert.equal(corpus.acceptedRecordCount,13);assert.match(corpus.rejectedRecords[0].rejectionReason,/blocked/);
  const input={acceptedRecords:corpus.acceptedRecords,exactProductAccepted:true,rating:job.rating,marketplaceReviewCount:job.reviewCount,price:job.price,verifiedProductMetadata:{canonicalUrl:verified.verifiedListingUrl}};
  expected=production.deriveDeterministicEvidenceResult(input);
  captureStage('final',{buyScore:expected.buyScore,verdict:expected.customerVerdict,confidence:corpus.deterministicConfidenceInputs,value:expected.valueForMoney,cost:cost.snapshot()});
  captureStage('privacy',{headers:{authorization:'PRIVATE'},apiKey:'PRIVATE',authCookie:'PRIVATE',sourceUrl:'https://amazon.ca/dp/B0DY3XB4WZ?token=PRIVATE'});
 },directory);
 assert.equal(io,0);
 capture=JSON.parse(readFileSync(`${directory}/${scanId}.json`,'utf8'));
 assert.equal(capture.status,'COMPLETED');assert.doesNotMatch(JSON.stringify(capture),/PRIVATE/);
 assert.ok(capture.events.some(e=>e.stage==='page'&&e.data.blockedOrChallenged));
 assert.equal(capture.events.find(e=>e.stage==='evaluation').data.result.acceptedCorpusHash,expected.acceptedCorpusHash);
 } finally {process.env.NODE_ENV=previous;globalThis.fetch=previousFetch;}
});
test('production cannot save capture, even with explicit directory',async()=>{
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';try{await withDevScanCapture('production-test',async()=>captureStage('identity',{productName:'test'}),directory);assert.equal(existsSync(`${directory}/production-test.json`),false);}finally{process.env.NODE_ENV=previous;}
});
test('captured bodies and hashes reconstruct identical corpus, score and verdict',()=>{
 const replayed=replayScan(capture,production);assert.deepEqual(replayed.final,expected);
 assert.equal(replayed.adjudications[0].acceptedRecords[0].body,fixture.rawRecords[0].body);
 const broken=structuredClone(capture);broken.events.find(e=>e.stage==='adjudication').data.args[0][0].body='Tampered body';assert.throws(()=>replayScan(broken,production),/drift/);
});
test('capture replay under tripwire performs zero external I/O',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import {installOfflineGuard} from './scripts/reviewintel-offline-guard.mjs';installOfflineGuard();const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const jiti=require('jiti')(process.cwd(),{alias:{'@':process.cwd()}});const p={...jiti('./lib/productSearchVerifier.ts'),...jiti('./lib/reviewEvidenceAdjudication.ts'),...jiti('./lib/reviewEvidenceDeterminism.ts'),...jiti('./lib/productIdentityTokens.ts'),...jiti('./lib/nativeReviewRetrieval.ts')};const {replayScan}=await import('./scripts/reviewintel-replay-scan.mjs');const fs=await import('node:fs');replayScan(JSON.parse(fs.readFileSync(${JSON.stringify(directory+'/'+scanId+'.json')},'utf8')),p);console.log('NETWORK_CALLS=0');`],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/NETWORK_CALLS=0/);
});
test('passive monitor attaches to next scan and prints captured final fields',async()=>{
 const controller=new AbortController();let observed;
 await monitorCaptures({directory,readyAt:Date.parse(capture.timestamp)-1,intervalMs:1,signal:controller.signal,onSnapshot:s=>{observed=s;controller.abort();}});
 assert.equal(observed.SCAN_ID,scanId);assert.equal(observed.FINAL_EVALUATION_COMPLETED,'YES');assert.equal(observed.REPLAY_CAPTURE_SAVED,'YES');assert.equal(observed.CORPUS_HASH,expected.acceptedCorpusHash);assert.equal(observed.OPENAI_CALLS,0);
 assert.equal(captureMonitorSnapshot(capture).VERDICT,expected.customerVerdict);
});
test('incomplete captures keep missing evidence and telemetry unknown',()=>{
 const snapshot=captureMonitorSnapshot({scanId:'incomplete',events:[]});
 assert.equal(snapshot.RAW_REVIEWS,undefined);
 assert.equal(snapshot.ACCEPTED_REVIEWS,undefined);
 assert.equal(snapshot.FIRECRAWL_CALLS,undefined);
 assert.equal(snapshot.ANALYSIS_CORPUS_HANDOFF,'UNKNOWN');
 assert.equal(snapshot.FINAL_EVALUATION_COMPLETED,'UNKNOWN');
 const zero=captureMonitorSnapshot({scanId:'observed-empty',events:[
  {stage:'extraction',data:{records:[]}},
  {stage:'telemetry',data:{firecrawlCalls:0}},
 ]});
 assert.equal(zero.RAW_REVIEWS,0);
 assert.equal(zero.FIRECRAWL_CALLS,0);
});
test('native page capture adds no external requests and records challenges without reviews',async()=>{
 const previousEnv=process.env.NODE_ENV,previousFetch=globalThis.fetch;
 const requests=[];let blocked=false;
 const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const html=fixture.rawRecords.map((r,i)=>`<div data-hook="review" id="R${i}"><span data-hook="review-body">${escape(r.body)}</span></div>`).join('');
 globalThis.fetch=async url=>{requests.push(String(url));return new Response(blocked?'Access denied '+html:html,{status:blocked?403:200});};
 const input={productTitle:fixture.product.productName,brand:'Takki',store:'Amazon.ca',listingUrl:fixture.candidates[0].url,maxQueries:1,maxPages:1,politeDelayMs:0};
 try {
  process.env.NODE_ENV='test';const baseline=await production.runNativeReviewRetrieval(input);const baselineRequests=[...requests];requests.length=0;
  process.env.NODE_ENV='development';const observed=await withDevScanCapture('native-capture-check',()=>production.runNativeReviewRetrieval(input),directory);
  assert.deepEqual(requests,baselineRequests);assert.ok(observed.reviewsCollected>0);assert.equal(observed.reviewsCollected,baseline.reviewsCollected);assert.deepEqual(observed.reviews.map(r=>r.body),baseline.reviews.map(r=>r.body));
  const file=JSON.parse(readFileSync(`${directory}/native-capture-check.json`,'utf8'));
  assert.ok(file.events.some(e=>e.stage==='extraction'&&e.data.records.every(r=>r.normalizedReviewHash&&r.body&&r.sourceDomain)));
  blocked=true;const denied=await withDevScanCapture('blocked-capture-check',()=>production.runNativeReviewRetrieval(input),directory);
  assert.equal(denied.reviewsCollected,0);
  const blockedCapture=JSON.parse(readFileSync(`${directory}/blocked-capture-check.json`,'utf8'));
  assert.ok(blockedCapture.events.some(e=>e.stage==='page'&&e.data.httpStatus===403&&e.data.blockedOrChallenged));
  assert.equal(blockedCapture.events.filter(e=>e.stage==='extraction').length,0);
 }finally{process.env.NODE_ENV=previousEnv;globalThis.fetch=previousFetch;}
});
