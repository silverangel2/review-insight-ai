# Sophie library research integration

Status: implementation for review; not deployed. No existing score, scan, library corpus or customer history is modified.

## Contract
Existing per-site Bearer SOPHIE_COMMAND_KEY authenticates all /api/command routes. Missing key or storage fails closed.
- GET /api/command/library: at most 20 recent product metadata rows.
- GET /api/command/library?productKey=...: up to 100 stored written reviews, with bounded body text, content IDs, source URLs (or null) and an evidence digest. Reviewer identity is omitted. Counts describe this bounded batch, not the marketplace total.
- POST /api/command/contributions: proposed Buy/Wait/Skip/Insufficient evidence; rationale and exact cited findings; server checks the current digest, quote membership and unique IDs. Server derives counts; official score/publication overrides are rejected. Pattern strength is an unverified signal, never verified AI authorship.
- GET /api/command/contributions?status=pending|accepted|rejected: owner-side queue.
- /admin/sophie-contributions: signed-in admin review UI.
- GET/PATCH /api/admin/sophie-contributions: existing admin session required. Decisions require a note, same-origin JSON, and pending status. Already-reviewed items cannot be changed via this route.

Assessment stays Insufficient evidence for comparing an original published verdict: this batch is not bound to an original scan/score. Sophie can propose a new research recommendation, but no false Agree/Disagree about an unseen verdict is permitted. Official score and publication overrides stay rejected.

The scan path calls `validateReviewProposal` in-process (`gradeCitedFindings`) to grade third-person findings whose quotes are exact substrings of reviews already gathered by the listing, the review hunt, and the library. That call does not fetch reviews, does not add a connector, and does not replace the buying-score Buy/Wait/Skip. If the check throws, the scan keeps its deterministic sentences.

Acceptance records human-reviewed research only. It does not publish or replace RI's existing result. Verify counts, source identity, semantic support and reasoning yourself; an exact quote alone does not prove its interpretation.

## Storage / rollout
Have the database owner review and apply only 20261019000100_sophie_contributions.sql to a staging database first; no bulk push/reset/repair. Table uses RLS, service-only grants, content-fingerprint idempotency, conditional review updates and an advisory-lock trigger capping the pending queue at 50. No public customer intake. Existing customers never block on the iMac. Failures surface honestly.

No hosted model API, paid collection API, autonomous scraping or background local inference is added. The separately packaged Python client uses the existing local empire model only on explicit request, one item at a time. It skips starting when Sophie is already answering a chat and refuses evidence above its context budget. Submit is a separate explicit step.

## Tests
Node 24: node --test tests/sophieContributions.test.mjs tests/sophieRoutes.test.mjs
Tests run real validators/routes/storage adapter with isolated auth/storage doubles; no real keys, model calls, email, deployments or live database writes. Verify real auth and SQL migration in staging before production. Full app typecheck/build was not completed: dependency installation timed out. No claim of production readiness.
