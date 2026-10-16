// Records keeper escalation emails instead of sending them.
export const SUPPORT_EMAIL = "support@getreviewintel.com";
export const EMAIL_FROM = "ReviewIntel <support@getreviewintel.com>";

const sent = [];
export function __reset() {
  sent.length = 0;
}
export function __sent() {
  return sent;
}
export function hasEmailProvider() {
  return true;
}
export async function sendReviewIntelEmail(input) {
  sent.push({ ...input });
  return { ok: true, provider: "stub", attempts: 1 };
}
export async function logEmailAttempt() {
  return true;
}
