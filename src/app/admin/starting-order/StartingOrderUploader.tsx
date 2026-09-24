"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EventItem {
  id: string;
  name: string;
  competition: { name: string };
  discipline: { name: string };
  category: { name: string };
  _count: { registrations: number };
}

export default function StartingOrderUploader({ events }: { events: EventItem[] }) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedEventId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", selectedEventId);

    try {
      const res = await fetch("/api/admin/upload-starting-order", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el archivo");

      setResult(data);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
        No hay eventos creados. Crea primero una competición y un evento en el panel de administración.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleUpload}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl shadow-black/40"
      >
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Seleccionar Evento / Prueba
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
            required
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.competition.name}) — {ev._count.registrations} inscritos actuales
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Archivo PDF de Orden de Salida
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded-xl p-2.5 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            required
          />
          <p className="text-[11px] text-slate-500">
            Acepta formato oficial de la RFEP (Campeonatos de España) y World Skate (Europeos/Mundiales).
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition shadow-lg shadow-indigo-900/30"
        >
          {loading ? "Leyendo y procesando PDF..." : "Importar Patinadores y Grupos"}
        </button>
      </form>

      {/* Resultado de la importación */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <span>✅</span> {result.count} Patinadores importados con éxito
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {result.skaters.length} registros
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 text-xs">
            {result.skaters.map((s: any, idx: number) => (
              <div key={idx} className="py-2.5 flex justify-between items-center font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400 w-8">#{s.startOrder}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 text-[11px]">
                    Grupo {s.warmupGroup}
                  </span>
                  <span className="font-sans font-medium text-slate-200 ml-1">
                    {s.fullName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {s.club && <span className="font-sans text-slate-500 hidden sm:inline text-[11px]">{s.club}</span>}
                  <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold px-2 py-0.5 rounded">
                    {s.country}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}