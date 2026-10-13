import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const jiti=require('jiti')(new URL('../review-evidence-scoring-test.js',import.meta.url).pathname);
const {adjudicateReviewEvidence}=jiti('./lib/reviewEvidenceAdjudication.ts');
const run=(args=[])=>spawnSync(process.execPath,['scripts/reviewintel-replay.mjs',...args],{encoding:'utf8'});
test('captured replay is deterministic and evaluates actual Takki corpus',()=>{
 const a=run(),b=run(); assert.equal(a.status,0);assert.equal(a.stdout,b.stdout);
 const takki=a.stdout.split('FIXTURE=takki')[1];assert.match(takki,/ACCEPTED_EXACT_PRODUCT_REVIEWS=13/);assert.match(takki,/ANALYSIS_CORPUS_HANDOFF=YES/);assert.match(takki,/FINAL_EVALUATION_COMPLETED=YES/);
 assert.match(a.stdout,/UNKNOWN_CAPTURE_MISSING/);assert.match(a.stdout,/NETWORK_CALLS=0/);
});
test('network attempt terminates before I/O even if callers would catch errors',()=>{const r=run(['--probe-network']);assert.equal(r.status,86);assert.match(r.stderr,/EXTERNAL_IO_ATTEMPT/);});
test('missing capture evidence remains unknown instead of zero or a completed evaluation',()=>{
 for (const id of ['kenmore','ninja']) {
  const r=run([`--fixture=${id}`]);assert.equal(r.status,0);
  assert.match(r.stdout,/VALID_REVIEW_RECORDS=UNKNOWN_CAPTURE_MISSING/);
  assert.match(r.stdout,/ACCEPTED_EXACT_PRODUCT_REVIEWS=UNKNOWN/);
  assert.match(r.stdout,/CORPUS_HASH=UNKNOWN/);
  assert.match(r.stdout,/FINAL_EVALUATION_COMPLETED=UNKNOWN_CAPTURE_MISSING/);
  assert.doesNotMatch(r.stdout,/ACCEPTED_EXACT_PRODUCT_REVIEWS=0|VERDICT=AVOID|FINAL_EVALUATION_COMPLETED=YES/);
 }
});
test('blocked review-shaped content cannot enter production corpus',()=>{
 const result=adjudicateReviewEvidence([{body:'Regression test review-shaped content',sourceUrl:'https://amazon.ca/dp/B0DY3XB4WZ',blockedOrChallenged:true}],{exactListingAccepted:true,exactListingUrl:'https://amazon.ca/dp/B0DY3XB4WZ'});
 assert.equal(result.acceptedRecordCount,0);assert.match(result.rejectedRecords[0].rejectionReason,/blocked/);
});
