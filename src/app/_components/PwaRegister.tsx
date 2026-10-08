"use client";

import { useEffect } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __rfInstallPrompt?: BIPEvent | null;
  }
}

// Registra el service worker (necesario para instalar la web como app y para
// recibir notificaciones push) y guarda el aviso de instalación del navegador
// para que la tarjeta de Perfil pueda usarlo aunque el evento ya se haya
// disparado en otra página. No cachea nada, solo gestiona las push.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__rfInstallPrompt = e as BIPEvent;
      window.dispatchEvent(new Event("rf-install-ready"));
    };
    const onInstalled = () => {
      window.__rfInstallPrompt = null;
      window.dispatchEvent(new Event("rf-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
