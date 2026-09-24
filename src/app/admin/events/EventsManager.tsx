"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EventsManager({
  initialEvents,
  competitions,
  disciplines,
  categories,
}: {
  initialEvents: any[];
  competitions: any[];
  disciplines: any[];
  categories: any[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || "");
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [gender, setGender] = useState<"" | "MALE" | "FEMALE">("");
  const [rosterLocksAt, setRosterLocksAt] = useState("");

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingCreate(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          competitionId,
          disciplineId,
          categoryId,
          rosterLocksAt,
          gender: gender || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando el evento");

      setName("");
      setGender("");
      setStatusMessage("✅ Evento creado correctamente");
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleGenerateSlots = async (eventId: string, segment: "SHORT" | "LONG") => {
    setActionLoadingId(`${eventId}-${segment}`);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/generate-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando slots");

      setStatusMessage(`✅ ${data.message}`);
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div className="p-3 bg-slate-900 border border-slate-700 text-xs rounded-xl font-medium">
          {statusMessage}
        </div>
      )}

      {/* Formulario Crear Evento */}
      <form
        onSubmit={handleCreateEvent}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl"
      >
        <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
          ➕ Crear Nuevo Evento / Prueba
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Nombre de la Prueba</label>
            <input
              type="text"
              placeholder="Ej: Senior Mujeres - Programa Corto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Competición</label>
            <select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              required
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Disciplina</label>
            <select
              value={disciplineId}
              onChange={(e) => setDisciplineId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              required
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Género</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "" | "MALE" | "FEMALE")}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
            >
              <option value="">Sin especificar</option>
              <option value="FEMALE">Femenino</option>
              <option value="MALE">Masculino</option>
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-slate-400 font-semibold">
              Cierre de Plantillas (Roster Locks At)
            </label>
            <input
              type="datetime-local"
              value={rosterLocksAt}
              onChange={(e) => setRosterLocksAt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loadingCreate}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
        >
          {loadingCreate ? "Creando evento..." : "Guardar Evento"}
        </button>
      </form>

      {/* Lista de Eventos */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          📋 Eventos Registrados ({initialEvents.length})
        </h2>

        <div className="space-y-3">
          {initialEvents.map((ev) => {
            const genderLabel =
              ev.gender === "FEMALE" ? "Femenino" : ev.gender === "MALE" ? "Masculino" : null;
            const slotsAvailableForDiscipline = ev.discipline?.slug === "libre";

            return (
              <div
                key={ev.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
                      {ev.competition?.name}
                    </span>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded">
                      {ev.discipline?.name} · {ev.category?.name}
                      {genderLabel ? ` · ${genderLabel}` : ""}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-1">{ev.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ev._count?.registrations || 0} patinadores inscritos •{" "}
                    <span className="text-amber-400 font-semibold">
                      {ev.slots?.length || 0} slots configurados
                    </span>
                  </p>
                </div>

                {/* Botonera de acciones por evento */}
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/events/${ev.id}/skaters`}
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    👥 Inscribir Patinadores ({ev._count?.registrations || 0})
                  </Link>

                  {slotsAvailableForDiscipline ? (
                    <>
                      <button
                        onClick={() => handleGenerateSlots(ev.id, "SHORT")}
                        disabled={actionLoadingId === `${ev.id}-SHORT`}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        {actionLoadingId === `${ev.id}-SHORT` ? "Cargando..." : "⚡ Slots Corto"}
                      </button>

                      <button
                        onClick={() => handleGenerateSlots(ev.id, "LONG")}
                        disabled={actionLoadingId === `${ev.id}-LONG`}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        {actionLoadingId === `${ev.id}-LONG` ? "Cargando..." : "⚡ Slots Largo"}
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic max-w-[220px]">
                      La generación automática de slots aún no está disponible para esta disciplina
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}