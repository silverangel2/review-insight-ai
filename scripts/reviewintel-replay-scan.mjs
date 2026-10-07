import assert from 'node:assert/strict';
export function replayScan(capture, production) {
  if (capture.schemaVersion !== 1) throw new Error('Unsupported capture schema');
  const { verifyProductCandidate, adjudicateReviewEvidence, deriveDeterministicEvidenceResult, extractProductIdentityTokenRoles, nativeSourceMatchesProduct } = production;
  for (const event of capture.events) {
    if (event.stage === 'evaluation' && production.DETERMINISTIC_SCORER_VERSION
      && event.data?.result?.scorerVersion !== production.DETERMINISTIC_SCORER_VERSION) {
      throw new Error(`SCORER_VERSION_MISMATCH: historical ${event.data?.result?.scorerVersion}, current ${production.DETERMINISTIC_SCORER_VERSION}; create a separate offline baseline, never overwrite the capture`);
    }
  }
  const adjudications = [];
  const evaluations = [];
  const verifications = [];
  for (const event of capture.events) {
    const { args, result } = event.data || {};
    if (event.stage === 'verification') {
      const replayed = verifyProductCandidate(...args);
      assert.deepEqual(JSON.parse(JSON.stringify(replayed)), result, 'Verifier replay drift');
      verifications.push(replayed);
      extractProductIdentityTokenRoles(args[0]);
    }
    if (event.stage === 'source-match') assert.equal(nativeSourceMatchesProduct(...args), result, 'Source matching replay drift');
    if (event.stage === 'identity') extractProductIdentityTokenRoles({ ...event.data, title:event.data.productName });
    if (event.stage === 'adjudication') {
      const replayed = adjudicateReviewEvidence(...args);
      assert.deepEqual(JSON.parse(JSON.stringify(replayed)), result, 'Adjudication replay drift');
      adjudications.push(replayed);
    }
    if (event.stage === 'evaluation') {
      const input = args[0];
      const expectedHashes = input.acceptedRecords.map(r=>r.stableEvidenceHash).sort();
      const corpus = [...adjudications].reverse().find(a => JSON.stringify(a.acceptedRecords.map(r=>r.stableEvidenceHash).sort()) === JSON.stringify(expectedHashes));
      if (expectedHashes.length && !corpus) throw new Error('Scoring corpus has no captured adjudication');
      const acceptedRecords = input.acceptedRecords.map(record=>{
        const rebuilt = corpus.acceptedRecords.find(r=>r.stableEvidenceHash===record.stableEvidenceHash);
        if (!rebuilt) throw new Error('Accepted hash missing from reconstructed corpus');
        return rebuilt;
      });
      const replayed = deriveDeterministicEvidenceResult({ ...input, acceptedRecords });
      assert.deepEqual(JSON.parse(JSON.stringify(replayed)), result, 'Scoring/verdict replay drift');
      evaluations.push(replayed);
    }
  }
  const final = evaluations.at(-1);
  return { scanId:capture.scanId, verifications, adjudications, evaluations, final, exactReplay:true };
}
