"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { utcToZonedInputValue, VENUE_TIMEZONE } from "@/lib/timezone";

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
  const [scheduledAt, setScheduledAt] = useState("");

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Plazo de fichaje propio de cada segmento (Corto/Largo), independiente
  // del rosterLocksAt general del evento — ver src/lib/segments.ts. Estado
  // local por segmentId, precargado con el valor que ya tenga guardado.
  const [segmentLocksInputs, setSegmentLocksInputs] = useState<Record<string, string>>({});
  const [segmentSavingId, setSegmentSavingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingEventId(null);
    setName("");
    setCompetitionId(competitions[0]?.id || "");
    setDisciplineId(disciplines[0]?.id || "");
    setCategoryId(categories[0]?.id || "");
    setGender("");
    setRosterLocksAt("");
    setScheduledAt("");
  };

  // El servidor interpreta lo que se escriba aquí como hora de la sede
  // (Paraguay) — ver api/admin/events/route.ts — así que al precargar el
  // formulario para editar hay que hacer la conversión inversa en esa misma
  // zona, y no con la hora local del navegador del admin (que puede estar
  // en cualquier país).
  const toDatetimeLocalValue = (isoDate: string) => utcToZonedInputValue(isoDate, VENUE_TIMEZONE);

  const handleEditClick = (ev: any) => {
    setEditingEventId(ev.id);
    setName(ev.name || "");
    setCompetitionId(ev.competitionId || ev.competition?.id || "");
    setDisciplineId(ev.disciplineId || ev.discipline?.id || "");
    setCategoryId(ev.categoryId || ev.category?.id || "");
    setGender(ev.gender || "");
    setRosterLocksAt(ev.rosterLocksAt ? toDatetimeLocalValue(ev.rosterLocksAt) : "");
    setScheduledAt(ev.scheduledAt ? toDatetimeLocalValue(ev.scheduledAt) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingCreate(true);
    setStatusMessage(null);

    const isEditing = Boolean(editingEventId);

    try {
      const res = await fetch(
        isEditing ? `/api/admin/events/${editingEventId}` : "/api/admin/events",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            competitionId,
            disciplineId,
            categoryId,
            rosterLocksAt,
            gender: gender || null,
            scheduledAt: scheduledAt || null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isEditing ? "Error editando el evento" : "Error creando el evento"));

      resetForm();
      setStatusMessage(isEditing ? "✅ Evento actualizado correctamente" : "✅ Evento creado correctamente");
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    setLoadingDelete(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/events/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error borrando el evento");

      if (editingEventId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      setDeleteConfirmText("");
      setStatusMessage("✅ Evento borrado correctamente");
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleSaveSegmentLocksAt = async (eventId: string, segmentId: string, overrideValue?: string) => {
    setSegmentSavingId(segmentId);
    setStatusMessage(null);

    const value = overrideValue ?? segmentLocksInputs[segmentId] ?? "";

    try {
      const res = await fetch(`/api/admin/events/${eventId}/segments/${segmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksAt: value || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error guardando el plazo del segmento");

      setStatusMessage(
        value
          ? "✅ Plazo del segmento actualizado"
          : "✅ Segmento vuelve a heredar el plazo general del evento"
      );
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setSegmentSavingId(null);
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

      {/* Formulario Crear/Editar Evento */}
      <form
        onSubmit={handleSubmitEvent}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
            {editingEventId ? "✏️ Editar Evento / Prueba" : "➕ Crear Nuevo Evento / Prueba"}
          </h2>
          {editingEventId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline"
            >
              Cancelar edición
            </button>
          )}
        </div>

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

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">
              Cierre de Plantillas (Roster Locks At){" "}
              <span className="font-normal text-slate-500">— hora de Paraguay</span>
            </label>
            <input
              type="datetime-local"
              value={rosterLocksAt}
              onChange={(e) => setRosterLocksAt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">
              Fecha y hora en pista (calendario público){" "}
              <span className="font-normal text-slate-500">— hora de Paraguay</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
            />
            <p className="text-[11px] text-slate-500">
              Cada usuario la verá convertida automáticamente a su zona horaria (o a la que elija) en /calendario.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loadingCreate}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
        >
          {loadingCreate
            ? editingEventId
              ? "Guardando cambios..."
              : "Creando evento..."
            : editingEventId
            ? "Guardar Cambios"
            : "Guardar Evento"}
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
            // Disciplinas que ya tienen plantilla de slots de Fantasy definida
            // en generate-slots/route.ts. Mantener esta lista sincronizada con
            // el mapa `disciplineTemplates` de esa ruta — si una disciplina
            // está aquí pero no en ese mapa (o al revés), el botón aparece
            // pero la API devuelve error, o al revés, el botón no aparece
            // aunque la API ya la soporte.
            const DISCIPLINES_WITH_SLOTS = ["libre", "inline", "solo-danza", "parejas", "pareja-danza"];
            const slotsAvailableForDiscipline = DISCIPLINES_WITH_SLOTS.includes(
              ev.discipline?.slug || ""
            );

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

                  {/* Plazo de fichaje propio por segmento (Corto/Largo). Si
                      se deja vacío, el segmento hereda el "Cierre de
                      Plantillas" general del evento de arriba. */}
                  {ev.segments && ev.segments.length > 0 && (
                    <div className="mt-3 space-y-1.5 bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Plazos de fichaje por segmento{" "}
                        <span className="font-normal normal-case text-slate-600">
                          — vacío = hereda el general de arriba
                        </span>
                      </p>
                      {ev.segments.map((seg: any) => {
                        const currentValue =
                          segmentLocksInputs[seg.id] ?? (seg.locksAt ? toDatetimeLocalValue(seg.locksAt) : "");
                        return (
                          <div key={seg.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-300 font-semibold w-24 shrink-0">
                              {seg.name}
                            </span>
                            <input
                              type="datetime-local"
                              value={currentValue}
                              onChange={(e) =>
                                setSegmentLocksInputs((prev) => ({ ...prev, [seg.id]: e.target.value }))
                              }
                              className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                            />
                            <span className="text-[10px] text-slate-500">— hora de Paraguay</span>
                            <button
                              type="button"
                              onClick={() => handleSaveSegmentLocksAt(ev.id, seg.id)}
                              disabled={segmentSavingId === seg.id}
                              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-700 transition"
                            >
                              {segmentSavingId === seg.id ? "Guardando…" : "Guardar"}
                            </button>
                            {seg.locksAt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSegmentLocksInputs((prev) => ({ ...prev, [seg.id]: "" }));
                                  handleSaveSegmentLocksAt(ev.id, seg.id, "");
                                }}
                                disabled={segmentSavingId === seg.id}
                                className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                              >
                                Quitar override
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Botonera de acciones por evento */}
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/events/${ev.id}/skaters`}
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    👥 Inscribir Patinadores ({ev._count?.registrations || 0})
                  </Link>

                  <Link
                    href={`/admin/results/${ev.id}`}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    📊 Resultados
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

                  <button
                    onClick={() => handleEditClick(ev)}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    ✏️ Editar
                  </button>

                  <button
                    onClick={() => {
                      setDeleteTarget({ id: ev.id, name: ev.name });
                      setDeleteConfirmText("");
                    }}
                    className="bg-slate-800 hover:bg-red-900 text-red-400 hover:text-red-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-800 transition"
                  >
                    🗑️ Borrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de confirmación de borrado */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-red-900 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">
              ⚠️ Borrar evento
            </h3>
            <p className="text-xs text-slate-300">
              Esto borrará permanentemente el evento{" "}
              <span className="font-bold text-slate-100">"{deleteTarget.name}"</span> y todo lo
              que dependa de él: slots, inscripciones y puntuaciones de patinadores, rosters y
              picks de fantasy, y predicciones. Esta acción no se puede deshacer.
            </p>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold text-xs">
                Escribe el nombre exacto del evento para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.name}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText("");
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={deleteConfirmText !== deleteTarget.name || loadingDelete}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                {loadingDelete ? "Borrando..." : "Borrar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}