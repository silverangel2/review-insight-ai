Run `npm run reviewintel:replay` in a second terminal. The existing dev server stays untouched. Select one capture with `npm run reviewintel:replay -- --fixture=takki`.

The harness loads sanitized saved inputs and invokes production identity extraction, candidate canonicalization/verification, evidence adjudication (normalization and deduplication), and deterministic final evaluation. It does not import the live database or run provider discovery. Network and subprocess entry points terminate the process with exit 86 before I/O; provider totals are zero for this execution, not historical captures.

Every fixture records provenance and limitations. Takki combines captured listing metadata with 13 later native scraper records; it is not a simultaneous scan snapshot. Philips preserves a final empty adjudication. Ninja's reported seven records and Kenmore's reported 73/20 and 16 counts have no available bodies and remain UNKNOWN. eufy has no recovered runtime fixture. Counts never create reviews. Unknown page statuses do not prove a page was unblocked.

FINAL_EVALUATION_COMPLETED means the real evaluator returned, including insufficient evidence. ANALYSIS_CORPUS_HANDOFF requires accepted hashes. A passing Takki replay does not certify Kenmore or authorize a real scan. Kenmore needs the saved candidate URLs/titles and actual review bodies before that gate can pass.

Tests use explicitly synthetic review-shaped input only for blocked-page rejection; it is never a captured corpus or success fixture.
