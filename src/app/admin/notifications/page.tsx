"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";

export default function AdminNotificationsPage() {
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [configured, setConfigured] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/push/send")
      .then((r) => r.json())
      .then((d) => {
        setSubscribers(d.subscribers ?? 0);
        setConfigured(!!d.configured);
      })
      .catch(() => {});
  }, []);

  async function send() {
    if (!title.trim() || !body.trim()) {
      setMsg("Escribe un título y un mensaje.");
      return;
    }
    if (!window.confirm(`¿Enviar la notificación a ${subscribers ?? "todos los"} dispositivos suscritos?`)) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url }),
      });
      const d = await res.json();
      setMsg(res.ok ? `Enviada a ${d.sent} dispositivos (${d.removed} dados de baja eliminados).` : d.error || "Error al enviar.");
    } catch {
      setMsg("Error al enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-50">🔔 Notificaciones push</h1>
          <p className="text-xs text-slate-400 mt-1">
            Envía un aviso a todos los dispositivos que han activado las notificaciones.
          </p>
        </div>
        <AdminNav />

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Dispositivos suscritos: <span className="font-bold text-slate-100">{subscribers ?? "…"}</span>
          </p>
          {!configured && (
            <p className="text-xs text-amber-400">
              Faltan las claves VAPID en Vercel: las notificaciones no se pueden enviar todavía.
            </p>
          )}
          <label className="block text-xs text-slate-400">
            Título
            <input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Mensaje
            <textarea
              value={body}
              maxLength={200}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Enlace al tocar la notificación (ruta de la web)
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <button
            onClick={send}
            disabled={sending || !configured}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar a todos"}
          </button>
          {msg && <p className="text-xs text-slate-300">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
