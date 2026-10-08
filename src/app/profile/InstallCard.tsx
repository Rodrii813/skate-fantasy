"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";

const TEXT = {
  es: {
    title: "📲 Instalar la app",
    desc: "Ábrela como una app desde tu pantalla de inicio y recibe avisos.",
    installed: "Ya estás usando la app instalada.",
    install: "Instalar ahora",
    iosSteps: [
      "Toca el botón Compartir (el cuadrado con la flecha) de Safari.",
      "Elige «Añadir a pantalla de inicio».",
      "Abre la app desde el nuevo icono.",
    ],
    iosOnlySafari: "En iPhone solo se puede instalar desde Safari: abre esta web en Safari.",
    androidSteps: [
      "Abre el menú del navegador (⋮ en Chrome, ☰ en Samsung Internet).",
      "Elige «Instalar aplicación» o «Añadir a pantalla de inicio».",
    ],
    desktop: "Desde el móvil podrás instalarla en la pantalla de inicio.",
  },
  en: {
    title: "📲 Install the app",
    desc: "Open it like an app from your home screen and get alerts.",
    installed: "You're already using the installed app.",
    install: "Install now",
    iosSteps: [
      "Tap the Share button (the square with an arrow) in Safari.",
      "Choose “Add to Home Screen”.",
      "Open the app from the new icon.",
    ],
    iosOnlySafari: "On iPhone you can only install from Safari: open this site in Safari.",
    androidSteps: [
      "Open the browser menu (⋮ in Chrome, ☰ in Samsung Internet).",
      "Choose “Install app” or “Add to Home screen”.",
    ],
    desktop: "On your phone you can install it on the home screen.",
  },
} as const;

export default function InstallCard() {
  const { locale } = useLocale();
  const t = TEXT[locale === "en" ? "en" : "es"];
  const [kind, setKind] = useState<"loading" | "installed" | "ios" | "ios-other" | "android" | "desktop">(
    "loading"
  );
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (standalone) return setKind("installed");
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/i.test(ua)) {
        const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
        return setKind(safari ? "ios" : "ios-other");
      }
      setKind(/Android|Mobile/i.test(ua) ? "android" : "desktop");
      const sync = () => setCanPrompt(!!window.__rfInstallPrompt);
      sync();
      window.addEventListener("rf-install-ready", sync);
      return () => window.removeEventListener("rf-install-ready", sync);
    } catch {
      setKind("desktop");
    }
  }, []);

  async function install() {
    const ev = window.__rfInstallPrompt;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice.catch(() => null);
    window.__rfInstallPrompt = null;
    setCanPrompt(false);
  }

  const steps = kind === "ios" ? t.iosSteps : kind === "android" && !canPrompt ? t.androidSteps : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-100">{t.title}</p>
        <p className="text-xs text-slate-400 mt-1">{t.desc}</p>
      </div>
      {kind === "installed" && <p className="text-xs text-slate-300">{t.installed}</p>}
      {kind === "desktop" && <p className="text-xs text-slate-300">{t.desktop}</p>}
      {kind === "ios-other" && <p className="text-xs text-slate-300">{t.iosOnlySafari}</p>}
      {kind === "android" && canPrompt && (
        <button
          onClick={install}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400"
        >
          {t.install}
        </button>
      )}
      {steps && (
        <ol className="space-y-1.5 text-xs text-slate-300">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-bold text-indigo-400">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
