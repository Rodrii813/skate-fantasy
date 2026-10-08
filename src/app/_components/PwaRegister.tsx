"use client";

import { useEffect } from "react";

// Registra el service worker (necesario para instalar la web como app y para
// recibir notificaciones push). No cachea nada, solo gestiona las push.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
