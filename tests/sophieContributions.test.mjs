import test from 'node:test';import assert from 'node:assert/strict';
import {reviewEvidence,evidenceDigest,validateReviewProposal} from '../lib/sophieContributions.ts';
const e=reviewEvidence([{body:'Battery failed after two days.',sourceUrl:'https://example.com/reviews/1',reviewerName:'Private name'},{body:'Battery failed after two days.'},{body:''}]);
const draft=()=>({productKey:'store:product',evidenceDigest:evidenceDigest(e),verdict:'Wait',assessment:'Insufficient evidence',rationale:'Durability needs investigation.',patternStrength:'none',findings:[{claim:'One report of battery failure.',citations:[{reviewId:e[0].id,quote:'Battery failed'}]}]});
test('evidence dedupes and excludes reviewer identity',()=>{assert.equal(e.length,1);assert.equal('reviewerName' in e[0],false)});
test('valid proposal derives counts and never claims AI authorship',()=>{const p=validateReviewProposal(draft(),e);assert.equal(p.findings[0].supportingReviewCount,1);assert.equal(p.aiAuthorshipVerified,false)});
test('stale corpus, missing evidence and invented quotes are rejected',()=>{assert.throws(()=>validateReviewProposal({...draft(),evidenceDigest:'old'},e));assert.throws(()=>validateReviewProposal(draft(),[]));const d=draft();d.findings[0].citations[0].quote='Five stars';assert.throws(()=>validateReviewProposal(d,e))});
test('unknown review, duplicate counts and official score overrides rejected',()=>{let d=draft();d.findings[0].citations[0].reviewId='unknown';assert.throws(()=>validateReviewProposal(d,e));d=draft();d.findings[0].citations.push({...d.findings[0].citations[0]});assert.throws(()=>validateReviewProposal(d,e));assert.throws(()=>validateReviewProposal({...draft(),score:99},e))});
test('in-program grader accepts a cited third-person finding and keeps the scan verdict', async () => {
  const { gradeCitedFindings } = await import('../lib/sophieContributions.ts');
  const reviews = [{ body: 'The battery lasted all week and still had charge left.', sourceUrl: 'https://www.amazon.ca/dp/B0EXAMPLE1' }];
  const graded = gradeCitedFindings({
    productKey: 'scan',
    reviews,
    verdict: 'Wait',
    findings: [{ claim: 'Buyers report long battery life.', quote: 'battery lasted all week' }],
  });
  assert.equal(graded.ok, true);
  assert.equal(graded.verdict, 'Wait');
  assert.deepEqual(graded.claims, ['Buyers report long battery life.']);
  const invented = gradeCitedFindings({
    productKey: 'scan',
    reviews,
    verdict: 'Buy',
    findings: [{ claim: 'Buyers report long battery life.', quote: 'caught fire on the counter' }],
  });
  assert.equal(invented.ok, false);
  assert.equal(invented.verdict, 'Buy');
});
