import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { installOfflineGuard } from './reviewintel-offline-guard.mjs';
import { loadResultAuditFunctions, auditCapturedResult } from './reviewintel-result-audit.mjs';
// Offline replay never launches a browser or reads machine-local indexes.
process.env.REVIEWINTEL_HEADLESS_RENDER = "off"; process.env.REVIEWINTEL_SITEMAP_INDEX_DIR ||= "/nonexistent-reviewintel-index";

const require = createRequire(import.meta.url);
const jiti = require('jiti')(process.cwd(), { alias: { '@': process.cwd() }, cache: false });
const identity = jiti('./lib/productIdentityTokens.ts');
const verifier = jiti('./lib/productSearchVerifier.ts');
const retrieval = jiti('./lib/nativeReviewRetrieval.ts');
const collector = jiti('./lib/reviewCollector.ts');
const policy = jiti('./lib/reviewRetrievalPolicy.ts');
const adjudication = jiti('./lib/reviewEvidenceAdjudication.ts');
const scoring = jiti('./lib/reviewEvidenceDeterminism.ts');
const urls = jiti('./lib/productUrlRetrieval.ts');
const adaptive = jiti('./lib/adaptiveReviewResearch.ts');
const completion = jiti('./lib/scanCompletion.ts');
const route = loadResultAuditFunctions();
const directory = 'tests/fixtures/reviewintel-benchmark/';
const read = name => JSON.parse(readFileSync(directory + name));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const dimensions = [
  'explicit-model', 'weak-model', 'parent-child', 'color-size-capacity', 'accessory-pool',
  'compatibility-model', 'manufacturer', 'marketplace', 'multiple-retailers', 'single-source',
  'blocked-signin', 'pagination', 'cursor-offset-pageNumber', 'duplicate-pages', 'syndication',
  'multilingual', 'many-reviews', 'few-reviews', 'positive', 'negative', 'mixed', 'severe-one-off',
  'recurring-severe', 'weak-value', 'conflicting-value', 'unknown-value', 'aggregate-only',
  'wrong-product', 'wrong-generation', 'sparse-metadata',
];
// Identity-only structural probes do not contain reviews or asserted real product observations.
const profiles = [
  { brand:'Aster',productName:'Aster HX-410 Steam Cleaner',model:'HX-410',category:'Steam Cleaner' },
  { brand:'Vale',productName:'Vale Wireless Speaker',model:null,category:'Speaker' },
  { brand:'Ember',productName:'Ember Nova Plus 4K Ultra HD Personal Projector',model:null,category:'Projector' },
  { brand:'Maple',productName:'Maple ZX500 Coffee Maker 750 ml Blue',model:'ZX500',category:'Coffee Maker' },
  { brand:'Harbor',productName:'Harbor Gen 3 Air Fitness Watch Size 10 Silver',model:'Gen 3 Air',category:'Fitness Watch' },
  { brand:'Quill',productName:'Quill C80 Security Camera Compatible with H40',model:'C80',category:'Security Camera' },
];
const jobFor = p => ({...p,scanId:'benchmark-structural',store:'Amazon.ca'});
const candidateFor = p => ({url:'https://www.amazon.ca/dp/B0TEST0001',title:p.productName,brand:p.brand,identityFetched:true});
const evaluate = (fixture, raw = fixture.adjudicationArgs[0]) => {
  const corpus = adjudication.adjudicateReviewEvidence(raw, fixture.adjudicationArgs[1]);
  return { corpus, result:scoring.deriveDeterministicEvidenceResult({...fixture.evaluationMetadata,acceptedRecords:corpus.acceptedRecords}) };
};
// Test transport envelopes are constructed around original captured bodies.
// They are never recorded as new source observations or new reviews.
const htmlFor = (fixture, records, next = '') => `<title>${fixture.adjudicationArgs[1].exactListingTitle}</title><script type="application/ld+json">${JSON.stringify({'@type':'Product',name:fixture.adjudicationArgs[1].exactListingTitle,brand:fixture.adjudicationArgs[1].brand,review:records.map(r=>({'@type':'Review',reviewBody:r.body,reviewRating:{ratingValue:r.rating},datePublished:r.date}))})}</script>${next}`;
async function withFetch(fake, action) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { return await action(); } finally { globalThis.fetch = original; }
}
function verifyInvariants(result, corpus) {
  assert.equal(result.acceptedReviewHashes.length,corpus.acceptedRecordCount);
  assert.equal(new Set(result.acceptedReviewHashes).size,result.acceptedReviewHashes.length);
  for (const claim of [...result.strengths,...result.complaints]) {
    assert.equal(claim.supportCount,claim.sourceHashes.length);
    assert.ok(claim.sourceHashes.every(hash=>result.acceptedReviewHashes.includes(hash)));
  }
  if (result.evidenceState!=='SUFFICIENT') {
    assert.equal(result.buyScore,null);assert.equal(result.valueForMoney,'Unknown');assert.equal(result.customerVerdict,'DO NOT BUY YET');
  }
  const reordered=scoring.deriveDeterministicEvidenceResult({acceptedRecords:[...corpus.acceptedRecords].reverse(),exactProductAccepted:corpus.exactProductAccepted,rating:result.marketplaceMetadataSnapshot.rating,marketplaceReviewCount:result.marketplaceMetadataSnapshot.reviewCount,price:result.marketplaceMetadataSnapshot.price});
  assert.equal(result.finalResultHash,reordered.finalResultHash);
}
export async function runGeneralBenchmark({layer='development'}={}) {
  installOfflineGuard();
  const rows=[];
  const check=async(id,tags,kind,action)=>{
    try { const details=await action();rows.push({id,dimensions:tags,kind,status:'PASS',details:details??null}); }
    catch(error) { rows.push({id,dimensions:tags,kind,status:'FAIL',error:error.message}); }
  };
  const oldLog=console.log;console.log=()=>{};
  try {
    if(layer==='holdout'||layer==='reserve') {
      const lock=read(layer==='reserve'?'reserve-holdout-lock.json':'holdout-lock.json');
      assert.equal(digest(readFileSync(directory+'holdout-identities.json')),lock.structuralSha256,'Holdout metadata changed');
      const sealed=read('holdout-identities.json');
      for(const [index,p] of (layer==='reserve'?[]:sealed.profiles).entries()) {
        await check(`holdout-identity-${index}`,['explicit-model','weak-model','manufacturer','marketplace','wrong-product','color-size-capacity','compatibility-model'],'SEALED_STRUCTURAL_METADATA',async()=>{
          const job=jobFor(p),candidate=candidateFor(p);
          assert.equal(verifier.verifyProductCandidate(job,candidate).canCollectReviews,true);
          assert.equal(verifier.verifyProductCandidate(job,{...candidate,title:'Unrelated spare component',brand:'Other'}).canCollectReviews,false);
          for(const url of ['https://maker.test/products/item','https://www.bestbuy.ca/en-ca/product/item/12345']) assert.equal(verifier.verifyProductCandidate(job,{...candidate,url}).canCollectReviews,true);
          const renamed={...p,brand:'UnrelatedMaker',productName:p.productName.replace(p.brand,'UnrelatedMaker')};
          assert.equal(verifier.verifyProductCandidate(jobFor(renamed),candidateFor(renamed)).canCollectReviews,true);
          return {models:identity.extractProductIdentityTokenRoles(p).primaryModels,queryCount:urls.buildRetrievalQueries(p).length};
        });
      }
      for(const [index,item] of lock.holdout.entries()) {
        await check(`holdout-capture-${index}`,['few-reviews','aggregate-only','mixed','single-source'],'SEALED_CAPTURE',async()=>{
          if(!existsSync(item.path)) throw Error('HOLDOUT_CAPTURE_MISSING');
          assert.equal(digest(readFileSync(item.path)),item.sha256,'Holdout capture changed');
          const capture=JSON.parse(readFileSync(item.path));
          const event=capture.events.filter(e=>e.stage==='adjudication').sort((a,b)=>b.data.args[0].length-a.data.args[0].length)[0];
          const evaluation=capture.events.find(e=>e.stage==='evaluation');
          if(!event||!evaluation) throw Error('HOLDOUT_INPUTS_NOT_CAPTURED');
          const corpus=adjudication.adjudicateReviewEvidence(...event.data.args);
          const result=scoring.deriveDeterministicEvidenceResult({...evaluation.data.args[0],acceptedRecords:corpus.acceptedRecords});
          verifyInvariants(result,corpus);
          const envelope=auditCapturedResult(item.path).result;
          assert.equal(envelope.scanId,capture.scanId||capture.metadata?.scanId||item.path.match(/(scan_[a-f0-9-]+)\.json/)?.[1]);assert.equal(envelope.meta.scanId,envelope.scanId);
          assert.equal(envelope.buyScore,result.buyScore);assert.equal(envelope.verdict,result.customerVerdict);assert.equal(envelope.valueForMoney,result.valueForMoney);assert.equal(envelope.commentsAnalyzed,corpus.acceptedRecordCount);
          for(const field of ['buyerConfidence','verdictConfidence'])assert.equal(envelope[field],envelope.confidence);
          if(!envelope.canonicalEvidenceEligible)assert.equal(envelope.confidence,null);
          const reverse=adjudication.adjudicateReviewEvidence([...event.data.args[0]].reverse(),event.data.args[1]);
          assert.deepEqual(corpus.acceptedRecords.map(r=>r.stableEvidenceHash).sort(),reverse.acceptedRecords.map(r=>r.stableEvidenceHash).sort());
          const decisions=capture.events.filter(e=>e.stage==='verification').map(e=>({before:e.data.result.canCollectReviews,after:verifier.verifyProductCandidate(...e.data.args).canCollectReviews}));
          return {captureSha256:item.sha256,capturedProduct:capture.events.find(e=>e.stage==='identity')?.data.productName,accepted:corpus.acceptedRecordCount,rejected:corpus.rejectedRecordCount,sourceDiversity:corpus.independentSourceCount,score:result.buyScore,verdict:result.customerVerdict,confidence:envelope.confidence,value:result.valueForMoney,verificationChanges:decisions.filter(d=>d.before!==d.after).length,limitations:'Captured inputs only; absent page bodies and retrieval cannot be reconstructed.'};
        });
      }
      if(layer==='reserve') for(const [index,item] of read('reserve-fixture-lock.json').fixtures.entries())await check(`holdout-missing-artifact-${index}`,['aggregate-only','few-reviews'],'SEALED_INCOMPLETE_SAVED_ARTIFACT',()=>{
        assert.equal(digest(readFileSync(item.path)),item.sha256);const fixture=JSON.parse(readFileSync(item.path));
        const raw=Array.isArray(fixture.rawRecords)?fixture.rawRecords:[];
        assert.equal(raw.length,0,'This incomplete-artifact regression expects no saved bodies');
        const corpus=adjudication.adjudicateReviewEvidence(raw,{...fixture.product,exactListingAccepted:false});
        const result=scoring.deriveDeterministicEvidenceResult({acceptedRecords:corpus.acceptedRecords,exactProductAccepted:false,rating:Number(fixture.product.rating),marketplaceReviewCount:Number(fixture.product.reviewCount)});
        verifyInvariants(result,corpus);assert.equal(result.buyScore,null);
        return {accepted:0,score:null,verdict:result.customerVerdict,value:result.valueForMoney,provenance:fixture.provenance,limitations:'Reported counts are not saved review bodies; no missing observations synthesized.'};
      });
    } else {
      const development=read('development.json');
      const [wearable,cooking,restricted,power]=development.corpora;
      for(const [index,p] of profiles.entries()) await check(`identity-${index}`,['explicit-model','weak-model','manufacturer','marketplace','compatibility-model','wrong-product'],'STRUCTURAL_METADATA',async()=>{
        const job=jobFor(p),candidate=candidateFor(p);
        assert.equal(verifier.verifyProductCandidate(job,candidate).canCollectReviews,true);
        const roles=identity.extractProductIdentityTokenRoles(p);
        if(p.model)assert.ok(roles.primaryModels.includes(p.model.toUpperCase()));
        const qs=[...urls.buildRetrievalQueries(job),...verifier.buildProductRetryQueries(job),...retrieval.buildNativeReviewSearchQueries({productTitle:p.productName,brand:p.brand,model:p.model})];
        assert.ok(qs.length>0);assert.ok(qs.every(q=>q.toLowerCase().includes(p.brand.toLowerCase())));
        assert.ok(qs.every(q=>!/123456|9\.9|999\.99/.test(q)));
        assert.equal(verifier.verifyProductCandidate(job,{...candidate,title:'A completely different item',brand:'Elsewhere'}).canCollectReviews,false);
        const renamed={...p,brand:'UnrelatedMaker',productName:p.productName.replace(p.brand,'UnrelatedMaker')};
        assert.equal(verifier.verifyProductCandidate(jobFor(renamed),candidateFor(renamed)).canCollectReviews,true);
        for(const url of ['https://maker.test/products/item','https://www.bestbuy.ca/en-ca/product/item/12345']) assert.equal(verifier.verifyProductCandidate(job,{...candidate,url}).canCollectReviews,true);
        return {models:roles.primaryModels,queryCount:qs.length};
      });
      await check('specification-boundary',['weak-model','wrong-generation'],'STRUCTURAL_METADATA',()=>{
        const p=profiles[2];const roles=identity.extractProductIdentityTokenRoles(p);
        assert.deepEqual(roles.primaryModels,['NOVA PLUS']);
        assert.equal(verifier.verifyProductCandidate(jobFor(p),{...candidateFor(p),title:'Ember Nova Plus Projector',model:'PX600'}).canCollectReviews,true);
        assert.equal(verifier.verifyProductCandidate(jobFor(p),{...candidateFor(p),title:'Ember Nova Projector'}).canCollectReviews,false);
      });
      await check('capacity-boundary-and-shared-colors',['weak-model','color-size-capacity'],'STRUCTURAL_METADATA',()=>{
        for(const capacity of ['500 ml','2 liters','6 qt','32 oz'])for(const color of identity.PRODUCT_COLOR_WORDS) {
          const p={brand:'UnrelatedMaker',productName:`UnrelatedMaker Studio Container ${capacity} ${color}`,model:null,category:'Container'};
          const roles=identity.extractProductIdentityTokenRoles(p);assert.ok(roles.colors.includes(color));
          assert.ok(roles.primaryModels.every(model=>p.productName.toLowerCase().includes(model.toLowerCase())),'Derived model must remain contiguous original identity text');
          assert.equal(verifier.verifyProductCandidate(jobFor(p),candidateFor(p)).canCollectReviews,true);
        }
      });
      await check('unitless-child-size',['parent-child','color-size-capacity'],'STRUCTURAL_METADATA',()=>{
        const p=profiles[4];
        for(const title of [p.productName.replace('Size 10','Size 9'),p.productName.replace('Size 10',''),p.productName.replace('Silver','Blue'),p.productName.replace('Gen 3','Gen 4')]) assert.equal(verifier.verifyProductCandidate(jobFor(p),{...candidateFor(p),title}).canCollectReviews,false,title);
      });
      for(const fixture of development.corpora) await check(`captured-${fixture.id}`,['multilingual','single-source','mixed','marketplace'],'CAPTURED_WRITTEN_EVIDENCE',()=>{
        const {corpus,result}=evaluate(fixture);verifyInvariants(result,corpus);
        const reverse=adjudication.adjudicateReviewEvidence([...fixture.adjudicationArgs[0]].reverse(),fixture.adjudicationArgs[1]);
        assert.deepEqual(corpus.acceptedRecords.map(r=>r.stableEvidenceHash).sort(),reverse.acceptedRecords.map(r=>r.stableEvidenceHash).sort());
        return {captureSha256:fixture.sha256,accepted:corpus.acceptedRecordCount,sourceDiversity:corpus.independentSourceCount,score:result.buyScore,verdict:result.customerVerdict,value:result.valueForMoney};
      });
      for(const fixture of development.corpora.filter(c=>c.capturePath)) await check(`route-envelope-${fixture.id}`,['persistence','single-source','aggregate-only','mixed'],'CURRENT_ROUTE_CAPTURE_REANALYSIS',()=>{
        const {result,deterministic}=auditCapturedResult(fixture.capturePath);
        assert.equal(result.scanId,fixture.scanId);assert.equal(result.meta.scanId,result.scanId);
        assert.equal(result.commentsAnalyzed,deterministic.acceptedReviewHashes.length);assert.equal(result.buyScore,deterministic.buyScore);assert.equal(result.verdict,deterministic.customerVerdict);assert.equal(result.valueForMoney,deterministic.valueForMoney);
        for(const key of ['confidence','verdictConfidence','buyerConfidence'])assert.equal(result[key],result.confidence);
        if(!result.canonicalEvidenceEligible)assert.equal(result.confidence,null);
        return {accepted:result.commentsAnalyzed,sourceDiversity:result.sourceDiversity,score:result.buyScore,verdict:result.verdict,confidence:result.confidence,value:result.valueForMoney};
      });
      await check('strong-positive',['positive','few-reviews'],'CAPTURED_SUBSET',()=>{
        const subset=wearable.adjudicationArgs[0].filter(r=>r.rating===5).slice(0,5);
        const {corpus,result}=evaluate(wearable,subset);verifyInvariants(result,corpus);assert.equal(result.customerVerdict,'BUY');
      });
      await check('negative-and-recurring-severe',['negative','recurring-severe'],'CAPTURED_SUBSET',()=>{
        const {corpus,result}=evaluate(power,[4,11,0,1,2].map(i=>power.adjudicationArgs[0][i]));verifyInvariants(result,corpus);assert.equal(result.customerVerdict,'AVOID');
      });
      await check('severe-one-off',['severe-one-off','mixed'],'CAPTURED_WRITTEN_EVIDENCE',()=>{
        const {result}=evaluate(cooking);assert.equal(result.deterministicScoringInputs.severeComplaintCount,1);assert.ok(result.complaints.some(c=>c.supportCount===1));assert.notEqual(result.customerVerdict,'AVOID');
      });
      await check('few-negative-reviews',['few-reviews','negative'],'CAPTURED_SUBSET',()=>{
        const {result}=evaluate(wearable,wearable.adjudicationArgs[0].filter(r=>r.rating===1));assert.equal(result.buyScore,null);assert.equal(result.customerVerdict,'DO NOT BUY YET');
      });
      await check('accessory-and-primary-experience',['accessory-pool','multilingual'],'CAPTURED_WRITTEN_EVIDENCE',()=>{
        const {corpus}=evaluate(wearable);assert.equal(corpus.rejectedRecords.filter(r=>/accessory/.test(r.rejectionReason||'')).length,1);
        const {corpus:main}=evaluate(power);assert.ok(main.acceptedRecords.some(r=>/motorcycle trickle charger/.test(r.body)),'Primary product usage must survive accessory mentions');
      });
      await check('shared-parent-pool',['parent-child','color-size-capacity'],'ADVERSARIAL_CAPTURE_METADATA',()=>{
        const original=wearable.adjudicationArgs[0][0];const options=wearable.adjudicationArgs[1];
        const absent=adjudication.adjudicateReviewEvidence([{...original,sharedReviewPool:true}],options);assert.equal(absent.acceptedRecordCount,0);
        const wrong=adjudication.adjudicateReviewEvidence([{...original,reviewedVariant:'Size 9 Gold'}],options);assert.equal(wrong.acceptedRecordCount,0);
        const right=adjudication.adjudicateReviewEvidence([{...original,sharedReviewPool:true,reviewedProductName:options.exactListingTitle,reviewedVariant:'Size 10 Silver'}],options);assert.equal(right.acceptedRecordCount,1);
      });
      await check('structured-parent-child-context',['parent-child','extraction'],'CAPTURED_PAYLOAD_TRANSPORT_SIMULATION',()=>{
        const original=evaluate(wearable).corpus.acceptedRecords[0];const options=wearable.adjudicationArgs[1];
        const review={'@type':'Review',reviewBody:original.body};
        const extract=child=>collector.extractWrittenReviewsFromHtml(`<script type="application/ld+json">${JSON.stringify({'@type':'ProductGroup',hasVariant:{'@type':'Product',name:options.exactListingTitle,brand:options.brand,review:child}})}</script>`,options.exactListingUrl);
        assert.equal(adjudication.adjudicateReviewEvidence(extract(review),options).acceptedRecordCount,0);
        assert.equal(adjudication.adjudicateReviewEvidence(extract({...review,itemReviewed:{name:options.exactListingTitle}}),options).acceptedRecordCount,1);
      });
      await check('multiple-retailer-provenance',['multiple-retailers','single-source','syndication'],'CAPTURED_BODIES_WITH_SIMULATED_SOURCE_METADATA',()=>{
        const original=power.adjudicationArgs[0];const options=power.adjudicationArgs[1];
        const across=original.map((r,i)=>({...r,sourceUrl:i%2?'https://retailer-a.test/products/exact':'https://retailer-b.test/products/exact',reviewedProductName:options.exactListingTitle,reviewedBrand:options.brand,reviewStructureVerified:true}));
        const corpus=adjudication.adjudicateReviewEvidence(across,options);
        assert.equal(corpus.acceptedRecordCount,evaluate(power).corpus.acceptedRecordCount);assert.equal(corpus.independentSourceCount,2);
        const copies=across.flatMap(r=>[r,{...r,sourceUrl:'https://syndication.test/products/exact'}]);
        assert.equal(adjudication.adjudicateReviewEvidence(copies,options).acceptedRecordCount,corpus.acceptedRecordCount);
        return {simulation:true,unique:corpus.acceptedRecordCount,independentDomains:2};
      });
      await check('syndicated-and-updated-duplicates',['syndication','many-reviews'],'ADVERSARIAL_CAPTURE_METADATA',()=>{
        const raw=power.adjudicationArgs[0];const {corpus,result}=evaluate(power,Array.from({length:1000},(_,i)=>raw[i%raw.length]));assert.equal(corpus.acceptedRecordCount,evaluate(power).corpus.acceptedRecordCount);verifyInvariants(result,corpus);
        const updates=[{...raw[0],reviewId:'same-id'},{...raw[1],reviewId:'same-id'}];
        const forward=adjudication.adjudicateReviewEvidence(updates,power.adjudicationArgs[1]);const reverse=adjudication.adjudicateReviewEvidence([...updates].reverse(),power.adjudicationArgs[1]);assert.deepEqual(forward.acceptedRecords.map(r=>r.stableEvidenceHash),reverse.acceptedRecords.map(r=>r.stableEvidenceHash));
      });
      await check('weak-unknown-conflicting-value',['weak-value','unknown-value','conflicting-value'],'CAPTURED_EVIDENCE_AND_ABSTRACT_POLICY_BOUNDARY',()=>{
        assert.equal(evaluate(wearable).result.valueForMoney,'Unknown');assert.equal(evaluate(cooking).result.valueForMoney,'Unknown');
        assert.equal(scoring.valueLabelFromReviewSupport({eligible:true,praiseCount:1,complaintCount:1}),'Fair');
        assert.equal(scoring.valueLabelFromReviewSupport({eligible:true,praiseCount:1,complaintCount:0}),'Unknown');
        assert.equal(scoring.valueLabelFromReviewSupport({eligible:true,praiseCount:2,complaintCount:0}),'Good');
      });
      await check('aggregate-is-not-evidence',['aggregate-only','many-reviews'],'ABSTRACT_METADATA_BOUNDARY',()=>{
        for(const rating of [null,1,5])for(const count of [0,5,100000]) {
          const result=scoring.deriveDeterministicEvidenceResult({acceptedRecords:[],exactProductAccepted:true,rating,marketplaceReviewCount:count,price:1});assert.equal(result.buyScore,null);assert.equal(result.valueForMoney,'Unknown');assert.equal(result.customerVerdict,'DO NOT BUY YET');
        }
        const {corpus,result}=evaluate(wearable);for(const rating of [null,1,5])for(const price of [null,1,9999]) {
          const changed=scoring.deriveDeterministicEvidenceResult({...wearable.evaluationMetadata,acceptedRecords:corpus.acceptedRecords,rating,price,marketplaceReviewCount:100000});
          for(const key of ['buyScore','customerVerdict','valueForMoney','finalResultHash'])assert.equal(changed[key],result[key]);
          assert.deepEqual(changed.strengths,result.strengths);assert.deepEqual(changed.complaints,result.complaints);
        }
      });
      await check('not-written-content',['aggregate-only','wrong-product'],'ADVERSARIAL_CAPTURE_METADATA',()=>{
        const original=power.adjudicationArgs[0][0];for(const evidenceType of ['AI_SUMMARY','PRODUCT_DESCRIPTION','SPECIFICATION','SEARCH_SNIPPET','AGGREGATE_METADATA'])assert.equal(adjudication.adjudicateReviewEvidence([{...original,evidenceType}],power.adjudicationArgs[1]).acceptedRecordCount,0,evidenceType);
      });
      await check('traceable-short-written-review',['extraction','few-reviews'],'CAPTURED_WRITTEN_EVIDENCE',()=>{
        const {corpus}=evaluate(wearable);const records=collector.extractWrittenReviewsFromHtml(htmlFor(wearable,corpus.acceptedRecords),wearable.adjudicationArgs[1].exactListingUrl);assert.equal(records.length,corpus.acceptedRecordCount);
      });
      await check('source-discovery-enrichment',['sparse-metadata','multiple-retailers','manufacturer','wrong-product'],'STRUCTURAL_TRANSPORT_SIMULATION',async()=>{
        const p=profiles[0];const discovered='https://unrelated-retailer.test/products/cleaner';const visited=[];
        await withFetch(async url=>{visited.push(String(url));if(String(url).includes('bing.com')||String(url).includes('duckduckgo.com'))return new Response(`<a href="${discovered}">Product</a>`);return new Response(`<title>${String(url).includes('/wrong')?'Unrelated item':p.productName}</title><script type="application/ld+json">${JSON.stringify({'@type':'Product',name:p.productName,brand:p.brand,model:p.model})}</script>`);},async()=>{
          await retrieval.runNativeReviewRetrieval({productTitle:p.productName,brand:p.brand,model:p.model,listingUrl:'https://maker.test/products/cleaner',maxPages:8,maxQueries:1,politeDelayMs:0});assert.ok(visited.includes(discovered),'Sparse discovery candidate was never enriched');
          const enriched=await verifier.prepareCandidateForVerification(jobFor(p),{url:discovered,title:null});assert.equal(verifier.verifyProductCandidate(jobFor(p),enriched).canCollectReviews,true);
        });
      });
      for(const key of ['page','pageNumber','cursor','offset']) await check(`public-pagination-${key}`,['pagination','cursor-offset-pageNumber','duplicate-pages'],'CAPTURED_PAYLOAD_TRANSPORT_SIMULATION',async()=>{
        const base=power.adjudicationArgs[1].exactListingUrl;const real=evaluate(power).corpus.acceptedRecords;const batches=[real.slice(0,5),real.slice(5,10),real.slice(10),real.slice(10),real.slice(10)];const visited=[];
        await withFetch(async url=>{
          const u=new URL(url);visited.push(u.toString());if(u.hostname.includes('bing')||u.hostname.includes('duckduckgo'))return new Response('',{status:404});
          const page=Number(u.searchParams.get(key)||1);const path=u.pathname.includes('product-reviews')?`${u.origin}${u.pathname}`:base.replace('/dp/','/product-reviews/')+'/';
          return new Response(htmlFor(power,batches[Math.min(page-1,4)],`<a href="${path}?${key}=${page+1}">Next reviews</a>`));
        },async()=>{
          const out=await retrieval.runNativeReviewRetrieval({productTitle:power.adjudicationArgs[1].exactListingTitle,brand:power.adjudicationArgs[1].brand,listingUrl:base,maxPages:16,maxQueries:1,politeDelayMs:0});
          assert.equal(out.reviewsCollected,real.length,'Retrieval stopped before all saved written reviews');assert.ok(visited.some(url=>url.includes(`${key}=3`)));assert.ok(!visited.some(url=>url.includes(`${key}=6`)),'Duplicate pagination failed to terminate');
          return {unique:out.reviewsCollected,pages:out.fetchedPageUrls?.length};
        });
      });
      await check('signin-is-terminal-per-source',['blocked-signin','multiple-retailers'],'CAPTURED_RESTRICTION_TRANSPORT_SIMULATION',async()=>{
        const base=restricted.adjudicationArgs[1].exactListingUrl;const visited=[];
        await withFetch(async url=>{const u=new URL(url);visited.push(u.toString());if(u.pathname.includes('product-reviews')){const r=new Response('Sign in',{status:200});Object.defineProperty(r,'url',{value:`${u.origin}/ax/claim`});return r;}return new Response('',{status:403});},async()=>{
          const out=await retrieval.runNativeReviewRetrieval({productTitle:restricted.adjudicationArgs[1].exactListingTitle,brand:restricted.adjudicationArgs[1].brand,listingUrl:base,maxPages:12,maxQueries:1,politeDelayMs:0});assert.equal(out.reviewsCollected,0);assert.equal(out.playwrightAttempted,false);assert.ok(visited.filter(url=>url.includes('product-reviews')).length<=1,'Sign-in endpoint was retried across pagination');
        });
      });
      await check('adaptive-depth-after-sufficiency',['pagination','many-reviews','multilingual'],'CAPTURED_BATCHES_WITH_MOCKED_DISCOVERY',async()=>{
        const actual=evaluate(power).corpus.acceptedRecords;const out=await adaptive.runAdaptiveReviewResearch({queries:['one','two','three','four','five'],sufficient:r=>r.length>=5,search:async()=>[power.adjudicationArgs[1].exactListingUrl],collect:async(_urls,_query,pass)=>[actual.slice(0,5),actual.slice(5,10),actual.slice(10),[],[]][pass-1],exactProduct:()=>true});assert.equal(out.records.length,actual.length);assert.ok(out.diagnostics.some(d=>d.SUFFICIENCY==='SUFFICIENT'&&d.STOP_REASON==='continue_useful_research'));
      });
      await check('confidence-is-evidence-quality',['single-source','multiple-retailers','few-reviews'],'ABSTRACT_POLICY_BOUNDARY',()=>{
        const input={exactListingUrl:wearable.adjudicationArgs[1].exactListingUrl,collectorSourceAccepted:true,screenshotTitle:'product title',listingTitle:'product title',screenshotStore:'Amazon.ca',listingStore:'Amazon.ca',rating:4.1,marketplaceReviewCount:1048,commentsAnalyzed:7,productProsCount:4,productConsCount:2,buyScore:6.1,verdict:'DO NOT BUY YET',finalDecisionSource:'deterministicAcceptedReviewCorpus',independentSourceCount:1};
        assert.equal(route.computeVerdictConfidenceAudit(input).verdictConfidence,55);assert.equal(route.computeVerdictConfidenceAudit({...input,commentsAnalyzed:30,marketplaceReviewCount:30}).verdictConfidence,65);
      });
      await check('persistence-exact-identity',['persistence'],'MOCKED_STORAGE_REAL_COMPLETION',async()=>{
        const scanId='benchmark-exact',email='owner@example.test',result={scanId,meta:{scanId}};
        const row={id:'row-exact',profile_email:email,analysis_json:result};
        const completed=await completion.completeAccountScan({email,scanId,result,save:async()=>row,read:async()=>row,consume:async()=>({ok:true}),finish:async()=>({ok:true})});assert.equal(completed.scanId,scanId);
        assert.throws(()=>completion.assertPersistedScan({...row,analysis_json:{scanId:'other'}},email,scanId),/IDENTITY_MISMATCH/);assert.throws(()=>completion.assertPersistedScan({...row,profile_email:'foreign@example.test'},email,scanId),/IDENTITY_MISMATCH/);
      });
      await check('blocked-display-capture',['blocked-signin','aggregate-only'],'CAPTURED_RESTRICTION_REGRESSION',()=>{
        assert.ok(restricted.pages.some(p=>p.finalUrl?.includes('/ax/claim')));assert.ok(restricted.pages.some(p=>p.httpStatus===403));
        const {result,corpus}=evaluate(restricted);assert.equal(corpus.acceptedRecordCount,0);assert.equal(result.buyScore,null);return {classification:'ACCESS_RESTRICTION',writtenReviews:0,score:null,verdict:result.customerVerdict,extractionDefect:'NOT_PROVABLE_WITHOUT_CAPTURED_HTML'};
      });
    }
  } finally { console.log=oldLog; }
  const covered=new Set(rows.flatMap(row=>row.dimensions));
  return {layer,scorerVersion:scoring.DETERMINISTIC_SCORER_VERSION,provenancePolicy:'No invented review bodies. Captured subsets, adversarial metadata, abstract policy inputs, and transport simulations are separately labeled; simulated sources are never represented as historical observations.',dimensions,uncovered:layer==='development'?dimensions.filter(d=>!covered.has(d)):[],cases:rows,totals:{cases:rows.length,passed:rows.filter(r=>r.status==='PASS').length,failed:rows.filter(r=>r.status==='FAIL').length},usage:{networkCalls:0,providerCalls:0,firecrawlCalls:0,newScans:0}};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
  const layer=process.argv.includes('--reserve-holdout')?'reserve':process.argv.includes('--holdout')?'holdout':'development';
  const report=await runGeneralBenchmark({layer});
  const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
  if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.totals.failed||report.uncovered.length?1:0;
}
