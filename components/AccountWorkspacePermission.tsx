"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";

type ClientAccountShape = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
};

function getCurrentAccount(): ClientAccountShape | null {
  try {
    return getClientAccount() as ClientAccountShape | null;
  } catch {
    return null;
  }
}

type PrivateAccessLanguage = "en" | "fr" | "es" | "zh" | "de" | "hi";

const privateAccessCopy: Record<PrivateAccessLanguage, {
  eyebrow: string;
  titlePrefix: string;
  fallbackAccount: string;
  body: string;
  allow: string;
}> = {
  en: {
    eyebrow: "One-time access",
    titlePrefix: "Private access for",
    fallbackAccount: "this account",
    body: "ReviewIntel will open your file picker for the next photo, screenshot, folder, TXT, or CSV only. This approval is not saved and does not give ongoing access.",
    allow: "Allow private file access"
  },
  fr: {
    eyebrow: "Accès unique",
    titlePrefix: "Accès privé pour",
    fallbackAccount: "ce compte",
    body: "ReviewIntel ouvrira le sélecteur de fichiers pour la prochaine photo, capture, dossier, fichier TXT ou CSV seulement. Cette autorisation n’est pas enregistrée et ne donne pas d’accès permanent.",
    allow: "Autoriser l’accès aux fichiers privés"
  },
  es: {
    eyebrow: "Acceso único",
    titlePrefix: "Acceso privado para",
    fallbackAccount: "esta cuenta",
    body: "ReviewIntel abrirá el selector de archivos solo para la próxima foto, captura, carpeta, TXT o CSV. Este permiso no se guarda y no concede acceso continuo.",
    allow: "Permitir acceso a archivos privados"
  },
  zh: {
    eyebrow: "一次性访问",
    titlePrefix: "私人访问：",
    fallbackAccount: "此账户",
    body: "ReviewIntel 只会为下一张照片、截图、文件夹、TXT 或 CSV 打开文件选择器。此授权不会保存，也不会提供持续访问权限。",
    allow: "允许访问私人文件"
  },
  de: {
    eyebrow: "Einmaliger Zugriff",
    titlePrefix: "Privater Zugriff für",
    fallbackAccount: "dieses Konto",
    body: "ReviewIntel öffnet die Dateiauswahl nur für das nächste Foto, den nächsten Screenshot, Ordner, TXT- oder CSV-Upload. Diese Zustimmung wird nicht gespeichert und erlaubt keinen dauerhaften Zugriff.",
    allow: "Privaten Dateizugriff erlauben"
  },
  hi: {
    eyebrow: "One-time access",
    titlePrefix: "Private access for",
    fallbackAccount: "this account",
    body: "ReviewIntel सिर्फ अगले photo, screenshot, folder, TXT या CSV के लिए file picker खोलेगा। यह approval save नहीं होगा और ongoing access नहीं देगा।",
    allow: "Private file access allow करें"
  }
};

function getPrivateAccessLanguage(): PrivateAccessLanguage {
  if (typeof window === "undefined") return "en";

  const candidates = [
    document.documentElement.lang,
    window.localStorage.getItem("reviewintel_language"),
    window.localStorage.getItem("reviewintel-language"),
    window.localStorage.getItem("language"),
    window.localStorage.getItem("locale")
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const match = candidates.find((value) => value.startsWith("fr") || value.startsWith("es") || value.startsWith("zh") || value.startsWith("de") || value.startsWith("hi"));

  if (match?.startsWith("fr")) return "fr";
  if (match?.startsWith("es")) return "es";
  if (match?.startsWith("zh")) return "zh";
  if (match?.startsWith("de")) return "de";
  if (match?.startsWith("hi")) return "hi";

  return "en";
}

export default function AccountWorkspacePermission() {
  const [visible, setVisible] = useState(false);
  const [account, setAccount] = useState<ClientAccountShape | null>(null);
  const [language, setLanguage] = useState<PrivateAccessLanguage>("en");
  const pendingInputRef = useRef<HTMLInputElement | null>(null);

  const copy = privateAccessCopy[language];

  const title = useMemo(() => {
    const label = account?.name || account?.email || copy.fallbackAccount;
    return `${copy.titlePrefix} ${label}`;
  }, [account, copy.fallbackAccount, copy.titlePrefix]);

  const requestPrivateFileAccess = useCallback((input?: HTMLInputElement | null) => {
    const latestAccount = getCurrentAccount();
    setLanguage(getPrivateAccessLanguage());
    setAccount(latestAccount);
    pendingInputRef.current = input ?? null;

    if (!latestAccount?.email && !latestAccount?.name) return;

    setVisible(true);
  }, []);

  function allowPrivateFileAccess() {
    if (typeof window === "undefined") return;

    setVisible(false);

    const pendingInput = pendingInputRef.current;
    pendingInputRef.current = null;

    if (pendingInput) {
      window.setTimeout(() => {
        pendingInput.click();
      }, 40);
    }
  }

  useEffect(() => {
    function onPrivateFileAccessRequest(event: Event) {
      const detail = (event as CustomEvent<{ input?: HTMLInputElement | null }>).detail;
      requestPrivateFileAccess(detail?.input ?? null);
    }

    window.addEventListener("reviewintel:private-file-access-request", onPrivateFileAccessRequest);

    return () => {
      window.removeEventListener("reviewintel:private-file-access-request", onPrivateFileAccessRequest);
    };
  }, [requestPrivateFileAccess]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[9998] mx-auto max-w-md overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/70 p-4 text-black shadow-[0_24px_90px_rgba(15,23,42,0.24)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-cyan-300/35 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 right-4 h-36 w-36 rounded-full bg-amber-300/35 blur-2xl" />
      <div className="relative">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">{copy.eyebrow}</p>
      <h2 className="mt-1 text-lg font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">
        {copy.body}
      </p>
      <button
        type="button"
        onClick={allowPrivateFileAccess}
        className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,#08b7a8,#2356a3)] px-4 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(35,86,163,0.24)]"
      >
        {copy.allow}
      </button>
      </div>
    </div>
  );
}
