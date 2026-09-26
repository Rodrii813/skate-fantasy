"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function CopyCodeButton({ code }: { code: string }) {
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.detail;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API no disponible (contexto no seguro, permiso denegado...);
      // el usuario siempre puede seleccionar y copiar el código a mano.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg transition"
    >
      {copied ? t.copied : t.copy}
    </button>
  );
}
