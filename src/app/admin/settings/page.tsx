"use client";

import { useState, useEffect } from "react";
import AdminNav from "../AdminNav";

// Convierte una fecha ISO (tal como la guarda Prisma) al formato que
// necesita <input type="datetime-local">, en hora LOCAL del navegador del
// admin (no UTC) — si no, al recargar la página la hora se vería desplazada
// respecto a la que el admin realmente escribió.
function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [countdownEnabled, setCountdownEnabled] = useState(false);
  const [countdownTitle, setCountdownTitle] = useState("");
  const [countdownLocation, setCountdownLocation] = useState("");
  const [countdownTargetDate, setCountdownTargetDate] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    const data = await res.json().catch(() => null);
    if (data) {
      setCountdownEnabled(!!data.countdownEnabled);
      setCountdownTitle(data.countdownTitle || "");
      setCountdownLocation(data.countdownLocation || "");
      setCountdownTargetDate(toLocalDatetimeInput(data.countdownTargetDate));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countdownEnabled,
          countdownTitle,
          countdownLocation,
          // El <input datetime-local> da la hora tal cual la escribió el
          // admin, sin zona horaria — new Date(...) la interpreta en la
          // zona horaria del SERVIDOR al guardar. Es una limitación
          // conocida (igual que otros formularios de fecha del admin), no
          // algo nuevo de esta pantalla.
          countdownTargetDate: countdownEnabled && countdownTargetDate ? countdownTargetDate : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMsg("✅ Guardado. Los cambios ya se ven en la home.");
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-black text-slate-50">⚙️ Ajustes del Sitio</h1>
          <p className="text-xs text-slate-400 mt-1">Configuración global de la home, editable sin tocar código.</p>
        </div>

        <AdminNav />

        {loading ? (
          <div className="text-xs text-slate-400">Cargando...</div>
        ) : (
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">⏳ Cuenta atrás de la home</h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  El banner grande de cuenta atrás que aparece arriba del todo en la portada. Puedes activarlo o
                  desactivarlo cuando quieras, y usarlo para cualquier evento (no solo los World Skate Games).
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs shrink-0 ml-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={countdownEnabled}
                  onChange={(e) => setCountdownEnabled(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4"
                />
                {countdownEnabled ? "Activada" : "Desactivada"}
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Título (ej: World Skate Games 2026)</label>
                <input
                  type="text"
                  value={countdownTitle}
                  onChange={(e) => setCountdownTitle(e.target.value)}
                  disabled={!countdownEnabled}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 disabled:opacity-40"
                  placeholder="World Skate Games 2026"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Sede / lugar (opcional)</label>
                <input
                  type="text"
                  value={countdownLocation}
                  onChange={(e) => setCountdownLocation(e.target.value)}
                  disabled={!countdownEnabled}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 disabled:opacity-40"
                  placeholder="Rimini, Italia"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Fecha y hora objetivo</label>
                <input
                  type="datetime-local"
                  value={countdownTargetDate}
                  onChange={(e) => setCountdownTargetDate(e.target.value)}
                  disabled={!countdownEnabled}
                  required={countdownEnabled}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 disabled:opacity-40"
                />
              </div>
            </div>

            {msg && <p className="text-xs">{msg}</p>}

            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
