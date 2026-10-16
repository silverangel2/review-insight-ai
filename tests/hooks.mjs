// Test-only ESM resolve hooks (merged: serves keeper-lane tests, sorter,
// wordsmith, translator and qa/rescue tests from one hook file).
// 1. The repo's TS sources use extensionless relative imports; Node's ESM
//    loader needs explicit extensions even with type stripping, so map
//    "./x" -> "./x.ts" when that file exists.
// 2. "@/lib/*" maps to ../lib/*.ts.
// 3. "@/lib/supabaseServer" and "@/lib/emailDelivery" resolve to in-memory
//    stubs: tests run the REAL lib code against stubbed storage/email.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const stubUrl = (name) => pathToFileURL(path.join(here, "stubs", name)).href;

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/supabaseServer" || /(^|\/)supabaseServer$/.test(specifier)) {
    return { url: stubUrl("supabaseServer.stub.mjs"), shortCircuit: true };
  }
  if (specifier === "@/lib/emailDelivery" || /(^|\/)emailDelivery$/.test(specifier)) {
    return { url: stubUrl("emailDelivery.stub.mjs"), shortCircuit: true };
  }
  if (specifier.startsWith("@/lib/")) {
    const target = path.resolve(here, "..", "lib", specifier.slice("@/lib/".length) + ".ts");
    if (existsSync(target)) return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if (
      (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ERR_UNSUPPORTED_DIR_IMPORT") &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      const candidate = path.resolve(path.dirname(parentPath), specifier + ".ts");
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw err;
  }
}
