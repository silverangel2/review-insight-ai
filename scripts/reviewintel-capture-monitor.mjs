import fs from 'node:fs';
const directory='/private/tmp/reviewintel-replay-captures';
export function captureMonitorSnapshot(capture) {
  const events=capture.events;
  const latest=stage=>events.filter(e=>e.stage===stage).at(-1)?.data;
  const identity=latest('identity') || {};
  const verification=events.filter(e=>e.stage==='verification' && e.data.result.canCollectReviews).at(-1)?.data.result;
  const adjudications=events.filter(e=>e.stage==='adjudication').map(e=>e.data.result);
  const latestAdjudication=adjudications.at(-1);
  const hashes=JSON.stringify(latestAdjudication?.acceptedRecords.map(r=>r.stableEvidenceHash).sort());
  const adjudication=adjudications.filter(a=>JSON.stringify(a.acceptedRecords.map(r=>r.stableEvidenceHash).sort())===hashes).sort((a,b)=>b.records.length-a.records.length)[0];
  const evaluation=latest('evaluation')?.result;
  const final=latest('final');
  const cost=final?.cost || latest('telemetry') || {};
  const extractions=events.filter(e=>e.stage==='extraction');
  const raw=extractions.length && extractions.every(e=>Array.isArray(e.data.records))
    ? extractions.reduce((sum,e)=>sum+e.data.records.length,0) : undefined;
  return {
    SCAN_ID:capture.scanId,PRODUCT_NAME:identity.productName,ASIN_OR_PRODUCT_ID:verification?.canonicalIdentifier,
    RAW_REVIEWS:raw,UNIQUE_REVIEWS:adjudication?adjudication.records.length-adjudication.deduplicatedRecordCount:undefined,
    ACCEPTED_REVIEWS:adjudication?.acceptedRecordCount,REJECTED_REVIEWS:adjudication?.rejectedRecordCount,
    CORPUS_HASH:evaluation?.acceptedCorpusHash,ANALYSIS_CORPUS_HANDOFF:evaluation ? (evaluation.acceptedReviewHashes.length?'YES':'NO') : 'UNKNOWN',
    OPENAI_CALLS:cost.openAiCalls,OPENAI_TOTAL_TOKENS:cost.openAiTotalTokens,SEARCH_PROVIDER_CALLS:cost.searchProviderCalls,FIRECRAWL_CALLS:cost.firecrawlCalls,
    BUY_SCORE:evaluation?.buyScore,VERDICT:evaluation?.customerVerdict,FINAL_EVALUATION_COMPLETED:evaluation?'YES':'UNKNOWN',REPLAY_CAPTURE_SAVED:'YES',
  };
}
export async function monitorCaptures({directory:root=directory,intervalMs=500,readyAt=Date.now(),onSnapshot=s=>{for(const [key,value] of Object.entries(s)) console.log(`${key}=${value??'UNKNOWN'}`);},signal}={}) {
  let attached=null,last='';
  console.log('PASSIVE_MONITOR_WAITING_FOR_NEW_SCAN=YES');
  while (!signal?.aborted) {
    try {
      for (const filename of fs.readdirSync(root).filter(f=>/^[a-zA-Z0-9_-]+\.json$/.test(f)).sort()) {
        const text=fs.readFileSync(`${root}/${filename}`,'utf8');
        const capture=JSON.parse(text);
        if (Date.parse(capture.timestamp)<readyAt || (attached && capture.scanId!==attached)) continue;
        attached ||= capture.scanId;
        const snapshot=captureMonitorSnapshot(capture),serialized=JSON.stringify(snapshot);
        if(serialized!==last){last=serialized;onSnapshot(snapshot);}
      }
    } catch(error) { if(error.code!=='ENOENT') console.error('PASSIVE_MONITOR_READ_RETRY=YES'); }
    await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }
}
if (process.argv[1]===new URL(import.meta.url).pathname) await monitorCaptures();
