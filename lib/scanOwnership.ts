// Who may see a scan result. Signed-in viewers only see their own account's row.
// Signed-out viewers only see a scan this browser ran (cookie grant, session, or HMAC scan token).
import { timingSafeEqual } from "crypto";
import { scanAccessToken } from "./scanAccess";

export type SignedOutScanProof = {
  cookieGrant?: boolean;
  sessionScanId?: string | null;
  scanToken?: string | null;
  ownedScanIds?: string[] | null;
};

function scanTokenMatches(scanId: string, token: string | null | undefined) {
  const presented = String(token || "");
  const expected = scanAccessToken(scanId);
  if (!expected || !presented || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export function signedOutOwnsScan(scanId: string, proof: SignedOutScanProof = {}) {
  const id = String(scanId || "").trim();
  if (!id) return false;
  if (proof.cookieGrant) return true;
  if (proof.sessionScanId && proof.sessionScanId === id) return true;
  if (scanTokenMatches(id, proof.scanToken)) return true;
  return Array.isArray(proof.ownedScanIds) && proof.ownedScanIds.includes(id);
}

export function scanVisibleToViewer(input: {
  scanId: string;
  viewerEmail?: string | null;
  envelopeEmail?: string | null;
  signedOutProof?: SignedOutScanProof;
}) {
  const envelope = String(input.envelopeEmail || "").trim().toLowerCase();
  const viewer = String(input.viewerEmail || "").trim().toLowerCase();
  if (viewer) return !envelope || envelope === viewer;
  if (envelope) return false;
  return signedOutOwnsScan(input.scanId, input.signedOutProof);
}
