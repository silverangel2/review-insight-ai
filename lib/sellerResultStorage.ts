import { getClientAccount } from "@/lib/clientAccount";

export const SELLER_LATEST_KEY = "reviewintelSellerResult";
export const SELLER_HISTORY_KEY = "reviewintel_seller_result_history";

type AccountIdentity = {
  email?: string;
  id?: string;
  accountId?: string;
  plan?: string;
} | null;

export function sellerStorageIdentity(account: unknown = getClientAccount()) {
  const value = account as AccountIdentity;

  return (
    value?.email ||
    value?.id ||
    value?.accountId ||
    "guest"
  )
    .trim()
    .toLowerCase();
}

export function sellerHistoryKey(account: unknown = getClientAccount()) {
  const value = account as AccountIdentity;

  const plan = (
    value?.plan ||
    "seller_starter"
  )
    .trim()
    .toLowerCase();

  return `${SELLER_HISTORY_KEY}:${plan}:${sellerStorageIdentity(value)}`;
}

export function sellerLatestKey(account: unknown = getClientAccount()) {
  return `${SELLER_LATEST_KEY}:${sellerStorageIdentity(account)}`;
}

export function saveLatestSellerResult(result: unknown, account: unknown = getClientAccount()) {
  const scopedKey = sellerLatestKey(account);
  const normalizedResult =
    result && typeof result === "object"
      ? {
          ...(result as Record<string, unknown>),
          savedAt:
            (result as Record<string, unknown>).savedAt ||
            (result as Record<string, unknown>).createdAt ||
            new Date().toISOString(),
          createdAt:
            (result as Record<string, unknown>).createdAt ||
            (result as Record<string, unknown>).savedAt ||
            new Date().toISOString()
        }
      : result;

  const payload = JSON.stringify(normalizedResult);

  sessionStorage.setItem(scopedKey, payload);
  localStorage.setItem(scopedKey, payload);

}

export function readLatestSellerResult(account: unknown = getClientAccount()) {
  try {
    const scopedKey = sellerLatestKey(account);
    const raw =
      sessionStorage.getItem(scopedKey) ||
      localStorage.getItem(scopedKey);

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function openSellerResult(result: unknown, account: unknown = getClientAccount()) {
  saveLatestSellerResult(result, account);
  window.location.href = "/dashboard/seller/result";
}
