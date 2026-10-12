import { emailLinkSecret, normalizeMailbox, readEmailToken } from "@/lib/emailLinks";

export type UnsubscribeInput = {
  token: string;
  email: string;
  oneClick: boolean;
  formPost: boolean;
};

export async function readUnsubscribeInput(request: Request): Promise<UnsubscribeInput> {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  let email = url.searchParams.get("email") || "";
  let oneClick = false;
  const contentType = request.headers.get("content-type") || "";
  const formPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = token || String(body.token ?? "");
    email = String(body.email ?? email);
  } else if (formPost) {
    const form = await request.formData().catch(() => null);
    token = token || String(form?.get("token") ?? "");
    email = String(form?.get("email") ?? email);
    oneClick = String(form?.get("List-Unsubscribe") ?? "") === "One-Click";
  }

  return { token, email, oneClick, formPost };
}

export function unsubscribeTarget(input: UnsubscribeInput, secret = emailLinkSecret()) {
  const tokenEmail = readEmailToken(input.token, secret);
  if (input.oneClick) return tokenEmail;
  return tokenEmail || normalizeMailbox(input.email);
}
