"use client";

import { useEffect } from "react";
import { getUiTextTranslation, getUiTextTranslations, readStoredLocale, resolveUiTextTranslationSource } from "@/lib/i18n";

const ADMIN_PATH_PREFIXES = ["/admin", "/admin-access", "/owner-access"];
const TEXT_SELECTOR =
  "button,a,p,h1,h2,h3,h4,h5,h6,label,span,li,th,td,small,strong,em,option,div";
const PLACEHOLDER_SELECTOR = "input[placeholder],textarea[placeholder]";
const ALT_SELECTOR = "img[alt]";
const MAX_TRANSLATABLE_TEXT_LENGTH = 600;

function isAdminPath() {
  if (typeof window === "undefined") return false;
  return ADMIN_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));
}

function hasElementChildren(element: Element) {
  return Array.from(element.childNodes).some((node) => node.nodeType === Node.ELEMENT_NODE);
}

function hasMixedTextNodes(element: Element) {
  const textNodes = Array.from(element.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.replace(/\s+/g, " ").trim())
  );

  return textNodes.length > 1 || (textNodes.length === 1 && element.childNodes.length > 1);
}

// Original-text memory lives in a WeakMap, not data-* attributes: mutating attributes on
// server-rendered elements before React hydrates them caused hydration mismatches.
const sourceMemory = new WeakMap<Element, Record<string, string | undefined>>();
function store(element: Element) {
  let record = sourceMemory.get(element);
  if (!record) { record = {}; sourceMemory.set(element, record); }
  return record;
}

function shouldSkipElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  if (["script", "style", "code", "pre", "textarea", "input"].includes(tag)) return true;
  if (element.closest("[data-ri-no-translate]")) return true;
  if (element.closest("[contenteditable='true']")) return true;
  return false;
}

function sourceTextFor(element: HTMLElement, locale: string, translations: Record<string, string>) {
  const stored = store(element).riSourceText;
  if (stored) {
    const resolvedStored = resolveUiTextTranslationSource(stored);
    if (resolvedStored) {
      store(element).riSourceText = resolvedStored;
      return resolvedStored;
    }

    return stored;
  }

  const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (!text || text.length > MAX_TRANSLATABLE_TEXT_LENGTH) return "";

  const resolvedText = resolveUiTextTranslationSource(text);
  if (resolvedText) {
    store(element).riSourceText = resolvedText;
    return resolvedText;
  }

  if (locale === "en" || !getUiTextTranslation(locale, text, translations)) return "";

  store(element).riSourceText = text;
  return text;
}

function sourceValueFor(current: string, stored: string | undefined, locale: string, translations: Record<string, string>) {
  const candidate = (stored || current).replace(/\s+/g, " ").trim();
  if (!candidate || candidate.length > MAX_TRANSLATABLE_TEXT_LENGTH) return "";

  const resolvedCandidate = resolveUiTextTranslationSource(candidate);
  if (resolvedCandidate) return resolvedCandidate;

  if (stored) return candidate;
  if (locale === "en" || !getUiTextTranslation(locale, candidate, translations)) return "";

  return candidate;
}

function replaceElementText(element: HTMLElement, translated: string) {
  const current = element.textContent ?? "";
  const leading = current.match(/^\s*/)?.[0] ?? "";
  const trailing = current.match(/\s*$/)?.[0] ?? "";
  element.textContent = `${leading}${translated}${trailing}`;
}

function replaceTextNodeText(node: ChildNode, translated: string) {
  const current = node.textContent ?? "";
  const leading = current.match(/^\s*/)?.[0] ?? "";
  const trailing = current.match(/\s*$/)?.[0] ?? "";
  node.textContent = `${leading}${translated}${trailing}`;
}

function translateDirectTextNodes(element: HTMLElement, locale: string, translations: Record<string, string>) {
  let textNodeIndex = 0;

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;

    const dataKey = `riTextNodeSource${textNodeIndex}`;
    const source = sourceValueFor(node.textContent || "", store(element)[dataKey], locale, translations);
    textNodeIndex += 1;

    if (!source) {
      delete store(element)[dataKey];
      continue;
    }

    store(element)[dataKey] = source;
    const translated = getUiTextTranslation(locale, source, translations);
    const current = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (translated && current !== translated) replaceTextNodeText(node, translated);
    if (!translated && locale === "en" && current !== source) replaceTextNodeText(node, source);
    if (!translated && locale !== "en") delete store(element)[dataKey];
  }
}

function applyTranslations() {
  if (typeof document === "undefined" || isAdminPath()) return;

  const locale = readStoredLocale();
  const translations = getUiTextTranslations(locale);

  for (const element of Array.from(document.querySelectorAll<HTMLElement>(TEXT_SELECTOR))) {
    if (shouldSkipElement(element)) continue;
    if (hasElementChildren(element) || hasMixedTextNodes(element)) {
      translateDirectTextNodes(element, locale, translations);
      continue;
    }

    const source = sourceTextFor(element, locale, translations);
    const translated = getUiTextTranslation(locale, source, translations);
    if (translated && element.textContent?.replace(/\s+/g, " ").trim() !== translated) replaceElementText(element, translated);
    if (!translated && locale === "en" && source && store(element).riSourceText && element.textContent?.replace(/\s+/g, " ").trim() !== source) {
      replaceElementText(element, source);
    }
    if (!translated && locale !== "en" && source) delete store(element).riSourceText;
  }

  for (const element of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(PLACEHOLDER_SELECTOR))) {
    if (element.closest("[data-ri-no-translate]")) continue;
    const source = sourceValueFor(element.getAttribute("placeholder") || "", store(element).riPlaceholderSource, locale, translations);
    if (!source) continue;
    store(element).riPlaceholderSource = source;
    const nextPlaceholder = getUiTextTranslation(locale, source, translations) || source;
    if (element.getAttribute("placeholder") !== nextPlaceholder && (locale === "en" || nextPlaceholder !== source)) {
      element.setAttribute("placeholder", nextPlaceholder);
    }
    if (locale !== "en" && nextPlaceholder === source) delete store(element).riPlaceholderSource;
  }

  for (const element of Array.from(document.querySelectorAll<HTMLImageElement>(ALT_SELECTOR))) {
    if (element.closest("[data-ri-no-translate]")) continue;
    const source = sourceValueFor(element.getAttribute("alt") || "", store(element).riAltSource, locale, translations);
    if (!source) continue;
    store(element).riAltSource = source;
    const nextAlt = getUiTextTranslation(locale, source, translations) || source;
    if (element.getAttribute("alt") !== nextAlt && (locale === "en" || nextAlt !== source)) {
      element.setAttribute("alt", nextAlt);
    }
    if (locale !== "en" && nextAlt === source) delete store(element).riAltSource;
  }

  for (const element of Array.from(document.querySelectorAll<HTMLElement>("[aria-label],[title]"))) {
    if (element.closest("[data-ri-no-translate]")) continue;
    const ariaSource = sourceValueFor(element.getAttribute("aria-label") || "", store(element).riAriaSource, locale, translations);
    if (ariaSource) {
      store(element).riAriaSource = ariaSource;
      const nextAria = getUiTextTranslation(locale, ariaSource, translations) || ariaSource;
      if (element.getAttribute("aria-label") !== nextAria && (locale === "en" || nextAria !== ariaSource)) element.setAttribute("aria-label", nextAria);
      if (locale !== "en" && nextAria === ariaSource) delete store(element).riAriaSource;
    }
    const titleSource = sourceValueFor(element.getAttribute("title") || "", store(element).riTitleSource, locale, translations);
    if (titleSource) {
      store(element).riTitleSource = titleSource;
      const nextTitle = getUiTextTranslation(locale, titleSource, translations) || titleSource;
      if (element.getAttribute("title") !== nextTitle && (locale === "en" || nextTitle !== titleSource)) element.setAttribute("title", nextTitle);
      if (locale !== "en" && nextTitle === titleSource) delete store(element).riTitleSource;
    }
  }
}

export function ClientTextLocalizer() {
  useEffect(() => {
    applyTranslations();

    const refresh = () => window.requestAnimationFrame(applyTranslations);
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("reviewintel:locale", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener("reviewintel:locale", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return null;
}
