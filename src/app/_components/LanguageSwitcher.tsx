"use client";

import { useLocale } from "@/lib/i18n/LocaleContext";

// Selector ES/EN de dos botones, pensado para ir en la barra de navegación
// junto al selector de zona horaria. El idioma se guarda en una cookie (ver
// LocaleContext) y afecta tanto al servidor (páginas) como al cliente
// (formularios), así que cambia toda la web de golpe.
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className={`inline-flex items-center rounded-full border border-white/15 text-[11px] font-semibold overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setLocale("es")}
        aria-pressed={locale === "es"}
        className={`px-2.5 py-1 transition ${
          locale === "es" ? "bg-white/15 text-white" : "text-ice-100/60 hover:text-white"
        }`}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`px-2.5 py-1 transition ${
          locale === "en" ? "bg-white/15 text-white" : "text-ice-100/60 hover:text-white"
        }`}
      >
        EN
      </button>
    </div>
  );
}
