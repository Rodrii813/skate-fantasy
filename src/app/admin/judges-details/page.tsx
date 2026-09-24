"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminNav from "../AdminNav";

export default function JudgesDetailsUploadPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [segmentName, setSegmentName] = useState("Long Program");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data);
          if (data.length > 0) setSelectedEventId(data[0].id);
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedEventId) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", selectedEventId);
    formData.append("segmentName", segmentName);

    try {
      const res = await fetch("/api/admin/upload-judges-details", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el acta");
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-black text-slate-50">
              📊 Importar Acta de Resultados (Judges Details)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sube el PDF oficial para calcular los puntos de cada slot automáticamente.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg"
          >
            ← Admin
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div className="space-y-1 text-xs">
            <label className="text-slate-400 font-semibold">Selecciona la Prueba</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.competition?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-slate-400 font-semibold">Segmento</label>
            <select
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
            >
              <option value="Long Program">Long Program (Programa Largo)</option>
              <option value="Short Program">Short Program (Programa Corto)</option>
            </select>
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-slate-400 font-semibold">Archivo PDF Oficial</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-indigo-600 file:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-xs transition"
          >
            {uploading ? "Procesando puntuaciones..." : "Ingestar y Puntuar Fantasy"}
          </button>
        </form>

        {result && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold border ${
              result.error
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            {result.error ? (
              <span>❌ {result.error}</span>
            ) : (
              <div>
                <span>
                  ✅ Procesados {result.skatersParsed} patinadores (
                  {result.registrationsInEvent} inscritos en el evento) →{" "}
                  {result.matchedAndScored} puntuados en "{result.segment}".
                </span>

                {result.unmatchedNames && result.unmatchedNames.length > 0 && (
                  <div className="mt-2 font-normal text-amber-400">
                    ⚠️ No encontrados como inscritos: {result.unmatchedNames.join(", ")}
                  </div>
                )}

                {result.registeredNames && (
                  <div className="mt-3 grid grid-cols-2 gap-3 font-normal">
                    <div>
                      <p className="text-slate-400 mb-1">
                        Inscritos en BD ({result.registeredNames.length})
                      </p>
                      <ul className="text-slate-300 space-y-0.5">
                        {result.registeredNames.map((n: string, i: number) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">
                        Leídos del PDF ({result.parsedNames.length})
                      </p>
                      <ul className="text-slate-300 space-y-0.5">
                        {result.parsedNames.map((n: string, i: number) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}