// Last-tier Chromium fetch for a public product URL.
//
// Not enabled in the default deployment. @sparticuz/chromium's compressed
// binary is about 50MB, and the analyze route already traces tesseract.wasm
// into the same function. Adding both risks Vercel's unzipped function limit.
// A cold Chromium start plus navigation can also spend the rest of the 50s
// collection budget. The tier runs only when REVIEWINTEL_LAYERED_CHROMIUM=on,
// the packages are installed, and the caller still has 15s left.
//
// It never solves a CAPTCHA and never signs in. A challenge page is returned
// to the caller, which stops that path.

type ChromiumModule = {
  default?: { args?: string[]; executablePath: () => Promise<string> };
  args?: string[];
  executablePath?: () => Promise<string>;
};

type PlaywrightModule = {
  chromium?: {
    launch: (options?: Record<string, unknown>) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options?: Record<string, unknown>) => Promise<{ status: () => number } | null>;
        content: () => Promise<string>;
        url: () => string;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

export type ChromiumFetchResult =
  | { state: "disabled" }
  | { state: "unavailable"; error: string }
  | { state: "page"; status: number | null; html: string; finalUrl: string };

const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

export function chromiumTierEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return ["on", "1", "true"].includes(String(env.REVIEWINTEL_LAYERED_CHROMIUM || "").toLowerCase());
}

export async function maybeSparticuzChromium(
  url: string,
  timeoutMs: number,
  env: Record<string, string | undefined> = process.env,
): Promise<ChromiumFetchResult> {
  if (!chromiumTierEnabled(env)) return { state: "disabled" };
  try {
    const chromiumMod = await dynamicImport("@sparticuz/chromium") as ChromiumModule;
    const playwright = await dynamicImport("playwright-core") as PlaywrightModule;
    const pack = chromiumMod.default || chromiumMod;
    const executablePath = pack.executablePath ? await pack.executablePath() : "";
    if (!playwright.chromium || !executablePath) return { state: "unavailable", error: "playwright-core or @sparticuz/chromium is not installed" };
    const browser = await playwright.chromium.launch({
      args: pack.args || [],
      executablePath,
      headless: true,
    });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      const status = response ? response.status() : null;
      const html = status === 401 || status === 403 || status === 429 ? "" : await page.content();
      return { state: "page", status, html, finalUrl: page.url() };
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : "chromium unavailable";
    return { state: "unavailable", error: message };
  }
}
