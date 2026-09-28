"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EventSkatersPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventData, setEventData] = useState<any>(null);
  const [allSkaters, setAllSkaters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario manual
  const [selectedSkaterId, setSelectedSkaterId] = useState("");
  const [warmupGroup, setWarmupGroup] = useState("1");
  const [skatingOrder, setSkatingOrder] = useState("1");
  // Por defecto el selector solo muestra patinadores de la disciplina+categoría
  // de esta prueba (si no, con miles de patinadores en total se vuelve
  // imposible de usar). Se puede desactivar para ver la lista completa.
  const [showAllSkaters, setShowAllSkaters] = useState(false);

  // Formulario Starting Order PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Obtener datos del evento y sus registros
      const resEvent = await fetch(`/api/admin/events`);
      const events = await resEvent.json();
      const current = events.find((e: any) => e.id === eventId);
      setEventData(current);

      // 2. Obtener lista global de patinadores
      const resSkaters = await fetch(`/api/admin/skaters`);
      const skaters = await resSkaters.json();
      if (Array.isArray(skaters)) {
        setAllSkaters(skaters);
        const relevant = current?.disciplineId && current?.categoryId
          ? skaters.filter((s: any) => s.disciplineId === current.disciplineId && s.categoryId === current.categoryId)
          : skaters;
        if (relevant.length > 0) setSelectedSkaterId(relevant[0].id);
        else if (skaters.length > 0) setSelectedSkaterId(skaters[0].id);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  // Inscribir manualmente
  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkaterId) return;

    const res = await fetch(`/api/admin/events/${eventId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skaterId: selectedSkaterId,
        warmupGroup: Number(warmupGroup),
        skatingOrder: Number(skatingOrder),
      }),
    });

    if (res.ok) {
      setMsg("✅ Patinador inscrito correctamente");
      setSkatingOrder(String(Number(skatingOrder) + 1));
      loadData();
    } else {
      setMsg("❌ Error al inscribir");
    }
  };

  // Subir Starting Order en PDF
  const handleUploadStartingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;

    setUploadingPdf(true);
    setMsg(null);

    const formData = new FormData();
    formData.append("file", pdfFile);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/import-starting-order`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar PDF");
      setMsg(`✅ Importados ${data.count} patinadores con sus grupos de calentamiento`);
      loadData();
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  // Patinadores que se muestran en el selector manual: por defecto, solo los
  // de la misma disciplina+categoría que esta prueba (evita tener que buscar
  // entre miles de patinadores de otras disciplinas/categorías).
  const relevantSkaters = allSkaters.filter((s: any) => {
    if (showAllSkaters) return true;
    if (!eventData?.disciplineId || !eventData?.categoryId) return true;
    return s.disciplineId === eventData.disciplineId && s.categoryId === eventData.categoryId;
  });

  // Eliminar patinador del evento
  const handleDeleteRegistration = async (skaterId: string) => {
    if (!confirm("¿Desinscribir a este patinador de la prueba?")) return;
    const res = await fetch(`/api/admin/events/${eventId}/registrations?skaterId=${skaterId}`, {
      method: "DELETE",
    });
    if (res.ok) loadData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
              {eventData?.competition?.name}
            </span>
            <h1 className="text-xl font-black text-slate-50 mt-1">
              👥 Patinadores Inscritos: {eventData?.name || "Cargando..."}
            </h1>
          </div>
          <Link
            href="/admin/events"
            className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500"
          >
            ← Volver a Eventos
          </Link>
        </div>

        {msg && (
          <div className="p-3 bg-slate-900 border border-slate-700 text-xs rounded-xl font-medium">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción 1: Inscribir Manualmente */}
          <form
            onSubmit={handleAddManual}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              ➕ Añadir Patinador a Mano
            </h2>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-400">Patinador</label>
                {eventData?.disciplineId && eventData?.categoryId && (
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showAllSkaters}
                      onChange={(e) => setShowAllSkaters(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    Ver todos ({allSkaters.length})
                  </label>
                )}
              </div>
              <select
                value={selectedSkaterId}
                onChange={(e) => setSelectedSkaterId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              >
                {relevantSkaters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} {s.country ? `(${s.country})` : ""}
                  </option>
                ))}
              </select>
              {!showAllSkaters && eventData?.disciplineId && eventData?.categoryId && (
                <p className="text-[10px] text-slate-500">
                  Mostrando solo patinadores de la disciplina y categoría de esta prueba ({relevantSkaters.length} de {allSkaters.length}).
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Grupo Calentamiento</label>
                <input
                  type="number"
                  min="1"
                  value={warmupGroup}
                  onChange={(e) => setWarmupGroup(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Orden / Dorsal</label>
                <input
                  type="number"
                  min="1"
                  value={skatingOrder}
                  onChange={(e) => setSkatingOrder(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-xs transition"
            >
              Inscribir Patinador
            </button>
          </form>

          {/* Opción 2: Ingestar Starting Order PDF */}
          <form
            onSubmit={handleUploadStartingOrder}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                📄 Ingestar Orden de Salida (PDF)
              </h2>
              <p className="text-[11px] text-slate-400">
                Detecta y extrae todos los patinadores, dorsales y grupos de calentamiento automáticamente.
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-indigo-600 file:text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={uploadingPdf || !pdfFile}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold py-2 rounded-xl text-xs transition border border-slate-700"
            >
              {uploadingPdf ? "Procesando Starting Order..." : "Subir y Procesar PDF"}
            </button>
          </form>
        </div>

        {/* Lista de Registrados */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Patinadores en la prueba ({eventData?._count?.registrations || 0})
          </h2>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 text-xs">
            {loading ? (
              <div className="p-4 text-center text-slate-400">Cargando lista...</div>
            ) : eventData?._count?.registrations === 0 ? (
              <div className="p-4 text-center text-slate-400">
                No hay patinadores inscritos en esta prueba todavía.
              </div>
            ) : (
              <div className="p-4 text-slate-300">
                Patinadores listos para el draft y puntuación del evento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}