"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";

const TEXT = {
  es: {
    title: "🔔 Notificaciones",
    desc: "Recibe un aviso cuando haya resultados de los eventos en los que participas.",
    enable: "Activar notificaciones",
    disable: "Desactivar notificaciones",
    on: "Notificaciones activadas en este dispositivo.",
    denied: "Has bloqueado las notificaciones. Actívalas en los ajustes del navegador o del móvil.",
    unsupported: "Este navegador no admite notificaciones.",
    iosInstall:
      "En iPhone primero instala la web en la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde el icono.",
    notConfigured: "Las notificaciones aún no están disponibles.",
    error: "No se han podido activar. Inténtalo de nuevo.",
  },
  en: {
    title: "🔔 Notifications",
    desc: "Get an alert when results are in for the events you take part in.",
    enable: "Enable notifications",
    disable: "Disable notifications",
    on: "Notifications are on for this device.",
    denied: "Notifications are blocked. Enable them in your browser or phone settings.",
    unsupported: "This browser doesn't support notifications.",
    iosInstall:
      "On iPhone, first install the site on your home screen (Share → Add to Home Screen) and open it from the icon.",
    notConfigured: "Notifications aren't available yet.",
    error: "Couldn't enable them. Please try again.",
  },
} as const;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function NotificationToggle() {
  const { locale } = useLocale();
  const t = TEXT[locale === "en" ? "en" : "es"];
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<
    "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on" | "notconfigured"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!vapid) return setState("notconfigured");
        const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true;
        if (isIos && !standalone) return setState("needs-install");
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
          return setState("unsupported");
        }
        if (Notification.permission === "denied") return setState("denied");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, [vapid]);

  async function enable() {
    setBusy(true);
    setError(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid as string),
        }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("on");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const message =
    state === "unsupported"
      ? t.unsupported
      : state === "needs-install"
        ? t.iosInstall
        : state === "denied"
          ? t.denied
          : state === "notconfigured"
            ? t.notConfigured
            : state === "on"
              ? t.on
              : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-100">{t.title}</p>
        <p className="text-xs text-slate-400 mt-1">{t.desc}</p>
      </div>
      {message && <p className="text-xs text-slate-300">{message}</p>}
      {error && <p className="text-xs text-rose-400">{t.error}</p>}
      {state === "off" && (
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {t.enable}
        </button>
      )}
      {state === "on" && (
        <button
          onClick={disable}
          disabled={busy}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {t.disable}
        </button>
      )}
    </div>
  );
}
