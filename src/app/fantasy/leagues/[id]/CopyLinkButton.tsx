"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function CopyLinkButton({ url }: { url: string }) {
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.detail;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Igual que en CopyCodeButton: sin Clipboard API siempre se puede
      // seleccionar y copiar el enlace a mano, ya que se muestra en texto.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
    >
      {copied ? t.linkCopied : t.copyLink}
    </button>
  );
}
