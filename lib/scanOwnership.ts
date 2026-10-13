// Who may see a scan result. Signed-in viewers only see their own account's row.
// Signed-out viewers only see a scan this browser ran (cookie grant, session, or scan token).

export type SignedOutScanProof = {
  cookieGrant?: boolean;
  sessionScanId?: string | null;
  scanToken?: string | null;
  ownedScanIds?: string[] | null;
};

export function signedOutOwnsScan(scanId: string, proof: SignedOutScanProof = {}) {
  const id = String(scanId || "").trim();
  if (!id) return false;
  if (proof.cookieGrant) return true;
  if (proof.sessionScanId && proof.sessionScanId === id) return true;
  if (proof.scanToken && proof.scanToken.length >= 8) return true;
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
