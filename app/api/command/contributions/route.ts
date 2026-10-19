import { NextResponse } from 'next/server';
import { sophieAuthError } from '@/lib/sophieCommand';
import { supabaseSelect } from '@/lib/supabaseServer';
import { reviewEvidence,validateReviewProposal } from '@/lib/sophieContributions';
import { listContributions,saveContribution } from '@/lib/sophieContributionStore';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(r:Request){if(sophieAuthError(r))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});try{return NextResponse.json({ok:true,contributions:await listContributions(new URL(r.url).searchParams.get('status')||'pending')},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({ok:false,error:'Queue unavailable'},{status:503})}}
export async function POST(r:Request){if(sophieAuthError(r))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});let b:Record<string,unknown>;try{const raw=await r.text();if(raw.length>131072)throw Error();b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.productKey!=='string'||b.productKey.length>240)throw Error()}catch{return NextResponse.json({ok:false,error:'Invalid or oversized JSON proposal'},{status:422})}
 let corpus:Record<string,unknown>[];try{const rows=await supabaseSelect<{corpus:Record<string,unknown>[]} >('product_review_library','product_key=eq.'+encodeURIComponent(String(b.productKey))+'&select=corpus&order=updated_at.desc&limit=1',{failClosed:true});corpus=rows[0]?.corpus||[]}catch{return NextResponse.json({ok:false,error:'Library unavailable; submission not accepted'},{status:503})}
 let payload:ReturnType<typeof validateReviewProposal>;try{payload=validateReviewProposal(b,reviewEvidence(corpus))}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Invalid proposal'},{status:422})}
 try{const contribution=await saveContribution(payload.productKey,payload);return NextResponse.json({ok:true,contribution,officialScoreChanged:false,published:false})}catch{return NextResponse.json({ok:false,error:'Submission could not be recorded'},{status:503})}}
