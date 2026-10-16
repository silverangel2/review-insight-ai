// Test-only ESM resolve hooks (mirrors the ri-inbox-ingest build pattern).
// 1. "@/lib/supabaseServer" and "@/lib/emailDelivery" resolve to in-memory
//    stubs: tests run the REAL keeper + lane code against stubbed storage.
// 2. Lane modules resolve to the repo's own lib/ (post-merge layout).
//    In this build tree they are verified against current-main copies.
// 3. Keeper modules resolve to ../lib/*.ts (Node type-stripping).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = (p) => pathToFileURL(p).href;

// Lane modules resolve to the repo's own lib/ post-merge; inside this
// build tree they fall back to the test-only ref-lib/ copies (NOT shipped).
const laneFile = (name) => {
  const repo = path.join(here, "..", "lib", `${name}.ts`);
  if (existsSync(repo)) return url(repo);
  return url(path.join(here, "..", "ref-lib", `${name}.ts`));
};

const MAP = {
  "@/lib/supabaseServer": url(path.join(here, "stubs", "supabaseServer.stub.mjs")),
  "@/lib/emailDelivery": url(path.join(here, "stubs", "emailDelivery.stub.mjs")),
  "@/lib/communityReviews": laneFile("communityReviews"),
  "@/lib/productReviewLibrary": laneFile("productReviewLibrary"),
  "@/lib/ownerFeedIngest": laneFile("ownerFeedIngest"),
  "@/lib/rescueQueue": laneFile("rescueQueue"),
  "@/lib/riKeeper": url(path.join(here, "..", "lib", "riKeeper.ts")),
  "@/lib/riKeeperLedger": url(path.join(here, "..", "lib", "riKeeperLedger.ts")),
};

export async function resolve(specifier, context, next) {
  if (MAP[specifier]) return { url: MAP[specifier], shortCircuit: true };
  try {
    return await next(specifier, context);
  } catch (err) {
    if (
      (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ERR_UNSUPPORTED_DIR_IMPORT") &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      return await next(specifier + ".ts", context);
    }
    throw err;
  }
}
