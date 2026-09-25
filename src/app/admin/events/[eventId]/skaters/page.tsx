"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EventSkatersPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventData, setEventData] = useState<any>(null);
  const [allSkaters, setAllSkaters] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario manual
  const [selectedSkaterId, setSelectedSkaterId] = useState("");
  const [warmupGroup, setWarmupGroup] = useState("1");
  const [skatingOrder, setSkatingOrder] = useState("1");
  const [manualSegment, setManualSegment] = useState("Short Program");

  // Formulario Starting Order PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [segmentName, setSegmentName] = useState("Short Program");
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
        if (skaters.length > 0) setSelectedSkaterId(skaters[0].id);
      }

      // 3. Obtener quién está inscrito de verdad en ESTA prueba, para poder
      // ver duplicados o nombres mal importados y quitarlos aquí mismo.
      const resRegs = await fetch(`/api/admin/events/${eventId}/registrations`);
      const regs = await resRegs.json();
      if (Array.isArray(regs)) setRegistrations(regs);
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
        segmentName: manualSegment,
      }),
    });

    if (res.ok) {
      setMsg(`✅ Patinador inscrito correctamente en "${manualSegment}"`);
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
    formData.append("segmentName", segmentName);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/import-starting-order`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar PDF");
      setMsg(`✅ Importados ${data.count} patinadores con su grupo de calentamiento de "${segmentName}"`);
      loadData();
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

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
              <label className="text-slate-400">Patinador</label>
              <select
                value={selectedSkaterId}
                onChange={(e) => setSelectedSkaterId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              >
                {allSkaters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} {s.country ? `(${s.country})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-slate-400">Segmento</label>
              <select
                value={manualSegment}
                onChange={(e) => setManualSegment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              >
                <option value="Short Program">Short Program (Programa Corto)</option>
                <option value="Long Program">Long Program (Programa Largo)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Grupo Calentamiento ({manualSegment === "Short Program" ? "Corto" : "Largo"})</label>
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

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Segmento
                </label>
                <select
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                >
                  <option value="Short Program">Short Program (Programa Corto)</option>
                  <option value="Long Program">Long Program (Programa Largo)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  El Corto y el Largo tienen sorteos de grupo de calentamiento distintos: sube el
                  PDF de cada uno por separado, eligiendo aquí el segmento correcto cada vez.
                </p>
              </div>

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
            Patinadores en la prueba ({registrations.length})
          </h2>
          <p className="text-[11px] text-slate-500">
            Si ves un nombre duplicado o mal leído del PDF (p.ej. con el país pegado al apellido),
            quítalo aquí con "Desinscribir" y corrígelo o bórralo del todo en{" "}
            <Link href="/admin/skaters" className="text-indigo-400 hover:underline">
              Gestión de Patinadores
            </Link>
            .
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 text-xs">
            {loading ? (
              <div className="p-4 text-center text-slate-400">Cargando lista...</div>
            ) : registrations.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                No hay patinadores inscritos en esta prueba todavía.
              </div>
            ) : (
              registrations.map((reg) => (
                <div key={reg.id} className="p-3 flex items-center justify-between hover:bg-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 w-6">
                      {reg.startOrder ?? "—"}
                    </span>
                    <span className="font-semibold text-slate-100">
                      {reg.skater.firstName} {reg.skater.lastName}
                    </span>
                    {reg.skater.country && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 font-semibold px-1.5 py-0.5 rounded">
                        {reg.skater.country}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      G.Corto: {reg.warmupGroupShort ?? "—"} · G.Largo: {reg.warmupGroupLong ?? "—"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteRegistration(reg.skaterId)}
                    className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded text-[11px]"
                  >
                    Desinscribir
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}