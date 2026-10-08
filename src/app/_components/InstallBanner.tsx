"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";

// Aviso para instalar la web como app. En Android usa el aviso nativo del
// navegador; en iPhone/iPad (donde no existe) enseña los 3 pasos. Solo sale en
// móvil/tablet, UNA vez por sesión del navegador (no en cada página), se oculta
// si ya está instalada y no vuelve a salir en 14 días si se cierra.

const KEY = "rf-install-dismissed";
const SEEN_KEY = "rf-install-seen";
const DAYS = 14;

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const TEXT = {
  es: {
    title: "Instala Rollart Fantasy",
    sub: "Ábrela como una app y recibe avisos de resultados.",
    install: "Instalar",
    close: "Cerrar",
    iosTitle: "Instálala en tu iPhone",
    steps: [
      "Toca el botón Compartir (el cuadrado con la flecha) de Safari.",
      "Elige «Añadir a pantalla de inicio».",
      "Abre la app desde el nuevo icono.",
    ],
  },
  en: {
    title: "Install Rollart Fantasy",
    sub: "Open it like an app and get result alerts.",
    install: "Install",
    close: "Close",
    iosTitle: "Install it on your iPhone",
    steps: [
      "Tap the Share button (the square with an arrow) in Safari.",
      "Choose “Add to Home Screen”.",
      "Open the app from the new icon.",
    ],
  },
} as const;

export default function InstallBanner() {
  const { locale } = useLocale();
  const t = TEXT[locale === "en" ? "en" : "es"];
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const pathname = usePathname();
  const [firstPath] = useState(pathname);

  // Si la persona cambia de página sin tocar el aviso, se quita solo
  useEffect(() => {
    if (pathname !== firstPath) setMode("none");
  }, [pathname, firstPath]);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (standalone) return;
      // Cerrado antes (cookie como respaldo por si el almacenamiento falla)
      if (document.cookie.includes(`${KEY}=1`)) return;
      try {
        const ts = Number(localStorage.getItem(KEY) || 0);
        if (ts && Date.now() - ts < DAYS * 86400000) return;
        // Ya se enseñó en esta sesión del navegador: no repetirlo al cambiar de página
        if (sessionStorage.getItem(SEEN_KEY)) return;
      } catch {}

      const ua = navigator.userAgent;
      // Solo móvil/tablet: en ordenador el aviso resulta molesto
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      if (!isMobile) return;
      const markSeen = () => {
        try {
          sessionStorage.setItem(SEEN_KEY, "1");
        } catch {}
      };
      const isIos = /iPhone|iPad|iPod/i.test(ua);
      const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
      if (isIos && isSafari) {
        setMode("ios");
        markSeen();
      }

      const onPrompt = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BIPEvent);
        setMode("android");
        markSeen();
      };
      window.addEventListener("beforeinstallprompt", onPrompt);
      return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    } catch {}
  }, []);

  function dismiss() {
    try {
      document.cookie = `${KEY}=1; path=/; max-age=${DAYS * 86400}; SameSite=Lax`;
    } catch {}
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setMode("none");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  }

  if (mode === "none") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" role="dialog" aria-label={t.title}>
      <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
        {mode === "android" ? (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-100">{t.title}</p>
              <p className="text-xs text-slate-400">{t.sub}</p>
            </div>
            <button
              onClick={install}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-400"
            >
              {t.install}
            </button>
            <button onClick={dismiss} aria-label={t.close} className="px-1 text-slate-500 hover:text-slate-300">
              ✕
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-100">{t.iosTitle}</p>
                <p className="text-xs text-slate-400">{t.sub}</p>
              </div>
              <button onClick={dismiss} aria-label={t.close} className="px-1 text-slate-500 hover:text-slate-300">
                ✕
              </button>
            </div>
            <ol className="mt-3 space-y-1.5 text-xs text-slate-300">
              {t.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-bold text-indigo-400">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
