"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";

type ClientAccountShape = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
};

function permissionKey(account: ClientAccountShape | null) {
  const identity = String(account?.email || account?.name || "guest").trim().toLowerCase();

  // Stable per-account device permission.
  // Do not include role/plan because beta/subscription/deployment changes can make
  // the app think this is a new permission.
  return `reviewintel:private-file-access:${identity}`;
}

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
    body: "ReviewIntel wants to access private photos, folders, screenshots, or CSV files from this device. This permission is saved only for this account on this device.",
    allow: "Allow private file access"
  },
  fr: {
    eyebrow: "Accès unique",
    titlePrefix: "Accès privé pour",
    fallbackAccount: "ce compte",
    body: "ReviewIntel souhaite accéder aux photos privées, dossiers, captures d’écran ou fichiers CSV de cet appareil. Cette autorisation est enregistrée uniquement pour ce compte sur cet appareil.",
    allow: "Autoriser l’accès aux fichiers privés"
  },
  es: {
    eyebrow: "Acceso único",
    titlePrefix: "Acceso privado para",
    fallbackAccount: "esta cuenta",
    body: "ReviewIntel quiere acceder a fotos privadas, carpetas, capturas de pantalla o archivos CSV de este dispositivo. Este permiso se guarda solo para esta cuenta en este dispositivo.",
    allow: "Permitir acceso a archivos privados"
  },
  zh: {
    eyebrow: "一次性访问",
    titlePrefix: "私人访问：",
    fallbackAccount: "此账户",
    body: "ReviewIntel 想要访问此设备上的私人照片、文件夹、截图或 CSV 文件。此权限只会为此账户保存在此设备上。",
    allow: "允许访问私人文件"
  },
  de: {
    eyebrow: "Einmaliger Zugriff",
    titlePrefix: "Privater Zugriff für",
    fallbackAccount: "dieses Konto",
    body: "ReviewIntel möchte auf private Fotos, Ordner, Screenshots oder CSV-Dateien auf diesem Gerät zugreifen. Diese Berechtigung wird nur für dieses Konto auf diesem Gerät gespeichert.",
    allow: "Privaten Dateizugriff erlauben"
  },
  hi: {
    eyebrow: "One-time access",
    titlePrefix: "Private access for",
    fallbackAccount: "this account",
    body: "ReviewIntel इस device से private photos, folders, screenshots या CSV files access करना चाहता है। यह permission सिर्फ इस account के लिए इसी device पर save होगी।",
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

  function isApproved(nextAccount: ClientAccountShape | null) {
    if (typeof window === "undefined") return false;
    if (!nextAccount?.email && !nextAccount?.name) return false;
    return window.localStorage.getItem(permissionKey(nextAccount)) === "approved";
  }

  function requestPrivateFileAccess(input?: HTMLInputElement | null) {
    const latestAccount = getCurrentAccount();
    setLanguage(getPrivateAccessLanguage());
    setAccount(latestAccount);
    pendingInputRef.current = input ?? null;

    if (!latestAccount?.email && !latestAccount?.name) return;

    if (!isApproved(latestAccount)) {
      setVisible(true);
      return;
    }

    if (input) {
      input.click();
    }
  }

  function allowPrivateFileAccess() {
    if (typeof window === "undefined") return;

    const latestAccount = account ?? getCurrentAccount();
    if (latestAccount?.email || latestAccount?.name) {
      window.localStorage.setItem(permissionKey(latestAccount), "approved");
    }

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

    function onFileInputClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const input = target?.closest?.('input[type="file"]') as HTMLInputElement | null;

      if (!input) return;

      const latestAccount = getCurrentAccount();
      if (!latestAccount?.email && !latestAccount?.name) return;

      if (isApproved(latestAccount)) return;

      event.preventDefault();
      event.stopPropagation();

      setLanguage(getPrivateAccessLanguage());
      setAccount(latestAccount);
      pendingInputRef.current = input;
      setVisible(true);
    }

    window.addEventListener("reviewintel:private-file-access-request", onPrivateFileAccessRequest);
    document.addEventListener("click", onFileInputClick, true);

    return () => {
      window.removeEventListener("reviewintel:private-file-access-request", onPrivateFileAccessRequest);
      document.removeEventListener("click", onFileInputClick, true);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-[9998] mx-auto max-w-sm rounded-3xl border border-white/60 bg-white/55 p-4 text-black shadow-2xl backdrop-blur-2xl md:hidden">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-black/55">{copy.eyebrow}</p>
      <h2 className="mt-1 text-lg font-black text-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-black/70">
        {copy.body}
      </p>
      <button
        type="button"
        onClick={allowPrivateFileAccess}
        className="mt-4 w-full rounded-2xl bg-black px-4 py-3 text-sm font-black text-white"
      >
        {copy.allow}
      </button>
    </div>
  );
}
