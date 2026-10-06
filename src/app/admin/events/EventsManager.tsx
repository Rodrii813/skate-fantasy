"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { utcToZonedInputValue, VENUE_TIMEZONE } from "@/lib/timezone";

// Recordar la última fecha/hora usada en cada tipo de campo, para no tener
// que volver a teclearla entera cada vez que se crea un evento o segmento
// nuevo — la mayoría de eventos de una misma jornada de competición caen en
// el mismo día y a horas parecidas. Se guarda en localStorage (por
// navegador; si el admin usa otro ordenador no lo verá) y solo sirve como
// valor de partida: el campo se puede editar como siempre.
const LAST_VALUE_KEYS = {
  rosterLocksAt: "rollart-admin-last-rosterLocksAt",
  scheduledAt: "rollart-admin-last-scheduledAt",
  segmentLocksAt: "rollart-admin-last-segment-locksAt",
  segmentOpensAt: "rollart-admin-last-segment-opensAt",
  predictionsOpensAt: "rollart-admin-last-predictions-opensAt",
  segmentSchedule: "rollart-admin-last-segment-schedule",
} as const;

function getRememberedValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function rememberValue(key: string, value: string) {
  if (typeof window === "undefined" || !value) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage puede fallar (modo privado, cuota llena...) — no es
    // grave, simplemente no se recuerda el valor para la próxima vez.
  }
}

// Los <input type="datetime-local"> nativos no aceptan pegar una fecha
// completa (el navegador solo deja pegar dígito a dígito dentro del propio
// widget) — es una limitación del input, no de la web. Esta función intenta
// interpretar el texto pegado (copiado, p. ej., de una hoja de cálculo con
// el horario de ~20 eventos) en varios formatos habituales y lo convierte al
// formato "YYYY-MM-DDTHH:mm" que espera el input. Si no reconoce el texto
// devuelve null y se deja el comportamiento de pegado normal del navegador.
function parsePastedDateTime(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  // YYYY-MM-DD[ T]HH:mm  (con o sin segundos, con espacio o "T")
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const [, y, mo, d, h, mi] = m;
    return `${y}-${mo}-${d}T${h}:${mi}`;
  }

  // DD/MM/YYYY o DD-MM-YYYY, con hora opcional
  m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (m) {
    const [, d, mo, y, h, mi] = m;
    return `${y}-${pad(Number(mo))}-${pad(Number(d))}T${pad(Number(h ?? 0))}:${mi ?? "00"}`;
  }

  // Solo fecha YYYY-MM-DD (sin hora): se deja la hora a 00:00
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo}-${d}T00:00`;
  }

  // Último recurso: dejar que Date lo interprete (p. ej. "28 Sep 2026 18:30")
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
      parsed.getHours()
    )}:${pad(parsed.getMinutes())}`;
  }

  return null;
}

// generate-slots/route.ts pone esta fecha lejana como placeholder al crear
// un segmento nuevo, para que nazca cerrado por defecto (ver ese archivo).
// De cara al admin, un segmento con esta fecha debe verse como "todavía sin
// fecha puesta", no como un valor real que haya que "quitar".
const FAR_FUTURE_PLACEHOLDER_YEAR = 2090;
function isFarFuturePlaceholderDate(value: string): boolean {
  const year = new Date(value).getFullYear();
  return !Number.isNaN(year) && year >= FAR_FUTURE_PLACEHOLDER_YEAR;
}

// Parejas y Pareja-Danza son siempre equipos mixtos (un chico + una chica),
// así que el campo "Género" no tiene sentido para esas dos disciplinas — a
// diferencia de Libre/Inline/Solo Danza, que sí se dividen en Masculino/
// Femenino. Se oculta el campo del formulario para esas disciplinas (ver
// más abajo) en vez de dejarlo puesto y confundir al admin.
const DISCIPLINES_WITHOUT_GENDER = ["parejas", "pareja-danza"];

// Nombres reales de los segmentos Corto/Largo por disciplina — deben
// coincidir exactamente con shortName/longName en
// generate-slots/route.ts (disciplineTemplates), porque generateSlotsForSegment
// busca/crea el Segmento por ese nombre. Solo Danza y Pareja-Danza no usan
// "Corto"/"Largo" sino la terminología propia de la danza (Style Dance/
// Freedance), así que los botones de "Generar Slots" deben decir eso en vez
// del genérico "Corto"/"Largo" para no confundir al admin.
const SEGMENT_LABELS_BY_DISCIPLINE: Record<string, { short: string; long: string }> = {
  libre: { short: "Corto", long: "Largo" },
  inline: { short: "Corto", long: "Largo" },
  "solo-danza": { short: "Style Dance", long: "Freedance" },
  parejas: { short: "Corto", long: "Largo" },
  "pareja-danza": { short: "Style Dance", long: "Free Dance" },
};

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
  const [rosterLocksAt, setRosterLocksAt] = useState(() => getRememberedValue(LAST_VALUE_KEYS.rosterLocksAt));
  const [scheduledAt, setScheduledAt] = useState(() => getRememberedValue(LAST_VALUE_KEYS.scheduledAt));
  // Solo se usa/envía cuando la disciplina elegida es "Show" — ver
  // generate-slots/route.ts (Cuartetos/Grupos Pequeños/Grupos Grandes son
  // competiciones separadas, así que cada evento necesita saber cuál es).
  const [showFormat, setShowFormat] = useState<"" | "QUARTET" | "SMALL_GROUP" | "LARGE_GROUP">("");
  // Marca este evento como "de prueba": aparece con un aviso en todas las
  // pantallas públicas donde se pueda interactuar con él (Fantasy,
  // Predicciones, calendario, ficha de competición), para que quien practique
  // con él no lo confunda con una prueba real. Pensado para el evento que se
  // crea antes de tener órdenes de salida reales, solo para que la gente
  // pruebe la interfaz.
  const [isTest, setIsTest] = useState(false);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Con muchos eventos creados, la lista entera (contadores + 3 paneles de
  // plazos por segmento + botonera) por evento ocupaba muchísimo espacio
  // vertical. Cada evento nace PLEGADO (solo cabecera: competición,
  // disciplina/categoría, nombre y contadores) y se despliega al pulsarlo,
  // para poder escanear la lista entera de un vistazo y solo abrir el que
  // se necesite tocar.
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const toggleEventExpanded = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allEventsExpanded = initialEvents.length > 0 && initialEvents.every((ev) => expandedEventIds.has(ev.id));
  const toggleAllEvents = () => {
    setExpandedEventIds(allEventsExpanded ? new Set() : new Set(initialEvents.map((ev) => ev.id)));
  };

  // Plazo de fichaje propio de cada segmento (Corto/Largo), independiente
  // del rosterLocksAt general del evento — ver src/lib/segments.ts. Estado
  // local por segmentId, precargado con el valor que ya tenga guardado.
  const [segmentLocksInputs, setSegmentLocksInputs] = useState<Record<string, string>>({});
  const [segmentSavingId, setSegmentSavingId] = useState<string | null>(null);

  // Hora de APERTURA propia de cada segmento (Corto/Largo) — antes de esa
  // hora el estado del segmento es "Upcoming" aunque ya tenga slots
  // generados (p.ej. el Largo, generado con antelación pero que no debe
  // abrirse hasta el día siguiente, cuando se sepa el resultado del Corto).
  // Ver src/lib/segments.ts (getSegmentDraftStatus).
  const [segmentOpensInputs, setSegmentOpensInputs] = useState<Record<string, string>>({});
  const [segmentOpenSavingId, setSegmentOpenSavingId] = useState<string | null>(null);

  // Apertura de PREDICCIONES por evento: hora programada + override manual
  // (mismo esquema que la apertura del draft por segmento de arriba). Estado
  // local por eventId, precargado con lo que ya tenga guardado.
  const [predictionsOpensInputs, setPredictionsOpensInputs] = useState<Record<string, string>>({});
  const [predictionsSavingId, setPredictionsSavingId] = useState<string | null>(null);

  // Hora de pista propia de cada segmento (para el calendario) y su split
  // opcional Top N / Resto — ver src/lib/calendarGrouping.ts. Estado local
  // por segmentId, con la clave "<segmentId>:schedule", ":splitLabel" y
  // ":splitSchedule" para no mezclar los 3 campos entre sí.
  const [segmentScheduleInputs, setSegmentScheduleInputs] = useState<Record<string, string>>({});
  const [segmentScheduleSavingId, setSegmentScheduleSavingId] = useState<string | null>(null);

  const isShowDiscipline = disciplines.find((d) => d.id === disciplineId)?.slug === "show";
  const isGenderlessDiscipline = DISCIPLINES_WITHOUT_GENDER.includes(
    disciplines.find((d) => d.id === disciplineId)?.slug || ""
  );

  // Si el admin tenía puesto un género y cambia la disciplina a Parejas o
  // Pareja-Danza (que no usan género), se limpia para no enviarlo sin
  // querer con el evento — el campo desaparece del formulario, así que si
  // no se limpia quedaría un valor "invisible" puesto por error previo.
  useEffect(() => {
    if (isGenderlessDiscipline && gender !== "") setGender("");
  }, [isGenderlessDiscipline, gender]);

  const resetForm = () => {
    setEditingEventId(null);
    setName("");
    setCompetitionId(competitions[0]?.id || "");
    setDisciplineId(disciplines[0]?.id || "");
    setCategoryId(categories[0]?.id || "");
    setGender("");
    // rosterLocksAt/scheduledAt NO se limpian a propósito: al crear varios
    // eventos seguidos de la misma jornada, lo normal es que caigan el
    // mismo día y a una hora parecida — así el admin solo tiene que ajustar
    // lo que cambie, en vez de volver a teclear la fecha entera cada vez.
    setShowFormat("");
    setIsTest(false);
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
    setShowFormat(ev.showFormat || "");
    setIsTest(Boolean(ev.isTest));
    setExpandedEventIds((prev) => new Set(prev).add(ev.id));
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
            showFormat: isShowDiscipline ? showFormat || null : null,
            isTest,
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

  // Guarda la hora de apertura de las Predicciones de un evento. Vacío =
  // sin hora propia (se abren en cuanto haya patinadores inscritos).
  const handleSavePredictionsOpensAt = async (eventId: string, overrideValue?: string) => {
    setPredictionsSavingId(eventId);
    setStatusMessage(null);

    const value = overrideValue ?? predictionsOpensInputs[eventId] ?? "";

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictionsOpensAt: value || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error guardando la apertura de predicciones");

      rememberValue(LAST_VALUE_KEYS.predictionsOpensAt, value);
      setStatusMessage(
        value
          ? "✅ Apertura de predicciones actualizada"
          : "✅ Predicciones sin hora de apertura propia (se abren al haber patinadores)"
      );
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setPredictionsSavingId(null);
    }
  };

  // Abre (o revierte) las Predicciones a mano, saltándose la hora de apertura.
  const handleTogglePredictionsManualOpen = async (eventId: string, manuallyOpened: boolean) => {
    setPredictionsSavingId(eventId);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictionsManuallyOpened: manuallyOpened }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error abriendo las predicciones");

      setStatusMessage(
        manuallyOpened ? "✅ Predicciones abiertas manualmente" : "✅ Apertura manual de predicciones desactivada"
      );
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setPredictionsSavingId(null);
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

      rememberValue(LAST_VALUE_KEYS.segmentLocksAt, value);
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

  // Guarda la hora de APERTURA propia de un segmento (opensAt). Vacío =
  // quita el override y el segmento vuelve a abrirse en cuanto tenga slots.
  const handleSaveSegmentOpensAt = async (eventId: string, segmentId: string, overrideValue?: string) => {
    setSegmentOpenSavingId(segmentId);
    setStatusMessage(null);

    const value = overrideValue ?? segmentOpensInputs[segmentId] ?? "";

    try {
      const res = await fetch(`/api/admin/events/${eventId}/segments/${segmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opensAt: value || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error guardando la apertura del segmento");

      rememberValue(LAST_VALUE_KEYS.segmentOpensAt, value);
      setStatusMessage(
        value ? "✅ Apertura del segmento actualizada" : "✅ Segmento vuelve a abrirse en cuanto tenga slots"
      );
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setSegmentOpenSavingId(null);
    }
  };

  // Abre (o cierra) el segmento a mano, saltándose `opensAt` — para cuando
  // el Corto termina antes/después de lo previsto y hay que abrir el Largo
  // ya mismo (o revertirlo si se activó por error).
  const handleToggleSegmentManualOpen = async (eventId: string, segmentId: string, manuallyOpened: boolean) => {
    setSegmentOpenSavingId(segmentId);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/segments/${segmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuallyOpened }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error abriendo el segmento");

      setStatusMessage(manuallyOpened ? "✅ Segmento abierto manualmente" : "✅ Apertura manual desactivada");
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setSegmentOpenSavingId(null);
    }
  };

  // Guarda la hora de pista propia de un segmento y/o su split Top N/Resto
  // — ver src/lib/calendarGrouping.ts. Los 3 campos son independientes: se
  // manda solo lo que se ha tocado en el formulario de este segmento.
  const handleSaveSegmentSchedule = async (eventId: string, segmentId: string) => {
    setSegmentScheduleSavingId(segmentId);
    setStatusMessage(null);

    const scheduledAtValue = segmentScheduleInputs[`${segmentId}:schedule`] ?? "";
    const scheduleLabelValue = segmentScheduleInputs[`${segmentId}:scheduleLabel`] ?? "";
    const splitLabelValue = segmentScheduleInputs[`${segmentId}:splitLabel`] ?? "";
    const splitScheduledAtValue = segmentScheduleInputs[`${segmentId}:splitSchedule`] ?? "";

    try {
      const res = await fetch(`/api/admin/events/${eventId}/segments/${segmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: scheduledAtValue || null,
          scheduleLabel: scheduleLabelValue || null,
          splitLabel: splitLabelValue || null,
          splitScheduledAt: splitScheduledAtValue || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error guardando el horario del segmento");

      rememberValue(LAST_VALUE_KEYS.segmentSchedule, scheduledAtValue);
      setStatusMessage("✅ Horario del segmento actualizado");
      router.refresh();
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
    } finally {
      setSegmentScheduleSavingId(null);
    }
  };

  // "key" identifica la acción para el spinner del botón (p.ej. "SHORT",
  // "LONG", o "QUARTET"/"SMALL_GROUP"/"LARGE_GROUP" para Show, que no tiene
  // Corto/Largo sino 3 formatos distintos — ver generate-slots/route.ts).
  const handleGenerateSlots = async (
    eventId: string,
    key: string,
    body:
      | { segment: "SHORT" | "LONG" }
      | { format: "QUARTET" | "SMALL_GROUP" | "LARGE_GROUP" }
      | Record<string, never>
  ) => {
    setActionLoadingId(`${eventId}-${key}`);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/generate-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

          {!isGenderlessDiscipline && (
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
          )}

          {isShowDiscipline && (
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">
                Formato de Show{" "}
                <span className="font-normal text-slate-500">
                  — Cuartetos/Grupos Pequeños/Grandes son competiciones separadas
                </span>
              </label>
              <select
                value={showFormat}
                onChange={(e) => setShowFormat(e.target.value as typeof showFormat)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                required
              >
                <option value="">Selecciona un formato…</option>
                <option value="QUARTET">Cuartetos</option>
                <option value="SMALL_GROUP">Grupos Pequeños</option>
                <option value="LARGE_GROUP">Grupos Grandes</option>
              </select>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3">
            <input
              type="checkbox"
              id="isTest"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
            />
            <label htmlFor="isTest" className="text-amber-200">
              <span className="font-semibold">🧪 Evento de prueba</span>
              <span className="block font-normal text-amber-200/70 mt-0.5">
                Muestra un aviso en Fantasy, Predicciones, el calendario y la ficha de la competición avisando de que
                es solo para practicar y no cuenta para nada real.
              </span>
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">
              Cierre de Plantillas (Roster Locks At){" "}
              <span className="font-normal text-slate-500">— hora de Paraguay</span>
            </label>
            <input
              type="datetime-local"
              value={rosterLocksAt}
              onChange={(e) => {
                setRosterLocksAt(e.target.value);
                rememberValue(LAST_VALUE_KEYS.rosterLocksAt, e.target.value);
              }}
              onPaste={(e) => {
                const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                if (parsed) {
                  e.preventDefault();
                  setRosterLocksAt(parsed);
                  rememberValue(LAST_VALUE_KEYS.rosterLocksAt, parsed);
                }
              }}
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
              onChange={(e) => {
                setScheduledAt(e.target.value);
                rememberValue(LAST_VALUE_KEYS.scheduledAt, e.target.value);
              }}
              onPaste={(e) => {
                const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                if (parsed) {
                  e.preventDefault();
                  setScheduledAt(parsed);
                  rememberValue(LAST_VALUE_KEYS.scheduledAt, parsed);
                }
              }}
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            📋 Eventos Registrados ({initialEvents.length})
          </h2>
          {initialEvents.length > 0 && (
            <button
              type="button"
              onClick={toggleAllEvents}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 underline"
            >
              {allEventsExpanded ? "Plegar todos" : "Desplegar todos"}
            </button>
          )}
        </div>

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
            const isShow = ev.discipline?.slug === "show";
            const isPrecision = ev.discipline?.slug === "precision";
            const slotsAvailableForDiscipline =
              isShow || isPrecision || DISCIPLINES_WITH_SLOTS.includes(ev.discipline?.slug || "");
            // Style Dance/Freedance en vez de "Corto"/"Largo" para Solo Danza
            // y Pareja-Danza — ver SEGMENT_LABELS_BY_DISCIPLINE arriba.
            const segmentLabels =
              SEGMENT_LABELS_BY_DISCIPLINE[ev.discipline?.slug || ""] || { short: "Corto", long: "Largo" };
            const isExpanded = expandedEventIds.has(ev.id);

            return (
              <div key={ev.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Cabecera siempre visible — pulsarla pliega/despliega el
                    resto (plazos por segmento y botonera de acciones), que es
                    lo que ocupa espacio de verdad cuando hay muchos eventos. */}
                <button
                  type="button"
                  onClick={() => toggleEventExpanded(ev.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 text-left hover:bg-slate-800/40 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
                        {ev.competition?.name}
                      </span>
                      <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded">
                        {ev.discipline?.name} · {ev.category?.name}
                        {genderLabel ? ` · ${genderLabel}` : ""}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mt-1 truncate">
                      {ev.name}
                      {ev.isTest && (
                        <span className="ml-2 align-middle text-xs font-semibold text-amber-400">🧪 Prueba</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ev._count?.registrations || 0} patinadores inscritos •{" "}
                      <span className="text-amber-400 font-semibold">
                        {ev.slots?.length || 0} slots configurados
                      </span>
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="space-y-4 px-5 pb-5 border-t border-slate-800/80 pt-4">
                    <div>
                  {/* Apertura de PREDICCIONES del evento: hora programada y
                      botón "Abrir ahora", igual que el draft por segmento.
                      Sin hora puesta, se abren en cuanto hay patinadores
                      inscritos (comportamiento de siempre); con una hora
                      futura, el evento sale como "Aún no abierto" en
                      /predictions, la home y el calendario hasta esa hora.
                      El cierre sigue siendo el plazo de fichaje. */}
                  {(() => {
                    const hasPredictionsOpensAt = Boolean(ev.predictionsOpensAt);
                    const predictionsOpensValue =
                      predictionsOpensInputs[ev.id] ??
                      (hasPredictionsOpensAt
                        ? toDatetimeLocalValue(ev.predictionsOpensAt)
                        : getRememberedValue(LAST_VALUE_KEYS.predictionsOpensAt));
                    return (
                      <div className="mt-3 space-y-1.5 bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Apertura de predicciones{" "}
                          <span className="font-normal normal-case text-slate-600">
                            — vacío = se abren en cuanto haya patinadores inscritos
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="datetime-local"
                            value={predictionsOpensValue}
                            onChange={(e) =>
                              setPredictionsOpensInputs((prev) => ({ ...prev, [ev.id]: e.target.value }))
                            }
                            onPaste={(e) => {
                              const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                              if (parsed) {
                                e.preventDefault();
                                setPredictionsOpensInputs((prev) => ({ ...prev, [ev.id]: parsed }));
                              }
                            }}
                            className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                          />
                          <span className="text-[10px] text-slate-500">— hora de Paraguay</span>
                          <button
                            type="button"
                            onClick={() => handleSavePredictionsOpensAt(ev.id)}
                            disabled={predictionsSavingId === ev.id}
                            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-700 transition"
                          >
                            {predictionsSavingId === ev.id ? "Guardando…" : "Guardar"}
                          </button>
                          {hasPredictionsOpensAt && (
                            <button
                              type="button"
                              onClick={() => {
                                setPredictionsOpensInputs((prev) => ({ ...prev, [ev.id]: "" }));
                                handleSavePredictionsOpensAt(ev.id, "");
                              }}
                              disabled={predictionsSavingId === ev.id}
                              className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                            >
                              Quitar hora
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleTogglePredictionsManualOpen(ev.id, !ev.predictionsManuallyOpened)
                            }
                            disabled={predictionsSavingId === ev.id}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition disabled:opacity-50 ${
                              ev.predictionsManuallyOpened
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                            }`}
                          >
                            {ev.predictionsManuallyOpened ? "🔓 Abiertas a mano" : "Abrir ahora"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

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
                          segmentLocksInputs[seg.id] ??
                          (seg.locksAt
                            ? toDatetimeLocalValue(seg.locksAt)
                            : getRememberedValue(LAST_VALUE_KEYS.segmentLocksAt));
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
                              onPaste={(e) => {
                                const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                                if (parsed) {
                                  e.preventDefault();
                                  setSegmentLocksInputs((prev) => ({ ...prev, [seg.id]: parsed }));
                                }
                              }}
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

                  {/* Hora de APERTURA propia por segmento (Corto/Largo).
                      Antes de esta hora el segmento sale como "Upcoming" en
                      /fantasy aunque ya tenga slots generados — pensado para
                      el Largo, que puede generarse con antelación pero no
                      debe abrirse hasta que se sepa el resultado del Corto
                      (a veces al día siguiente). Un segmento recién creado
                      (al generar sus slots) nace CERRADO por defecto — sale
                      con una fecha placeholder muy lejana como opensAt (ver
                      generate-slots/route.ts) — así que hay que ponerle
                      fecha aquí o pulsar "Abrir ahora" cuando toque. El
                      botón de abrir/cerrar a mano salta esta hora sin
                      borrarla. Los segmentos de eventos antiguos (de antes
                      de este cambio) siguen con su comportamiento previo:
                      vacío = se abren en cuanto tienen slots. */}
                  {ev.segments && ev.segments.length > 0 && (
                    <div className="mt-3 space-y-1.5 bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Apertura del draft por segmento{" "}
                        <span className="font-normal normal-case text-slate-600">
                          — cerrado por defecto en segmentos nuevos: ponle fecha o pulsa &quot;Abrir ahora&quot;
                        </span>
                      </p>
                      {ev.segments.map((seg: any) => {
                        // El placeholder de 2099 que pone generate-slots al
                        // crear el segmento no cuenta como "fecha puesta" de
                        // cara al admin: se ve vacío, con la última fecha
                        // usada como valor de partida (ver LAST_VALUE_KEYS).
                        const hasRealOpensAt = seg.opensAt && !isFarFuturePlaceholderDate(seg.opensAt);
                        const currentOpensValue =
                          segmentOpensInputs[seg.id] ??
                          (hasRealOpensAt
                            ? toDatetimeLocalValue(seg.opensAt)
                            : getRememberedValue(LAST_VALUE_KEYS.segmentOpensAt));
                        return (
                          <div key={seg.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-300 font-semibold w-24 shrink-0">
                              {seg.name}
                            </span>
                            <input
                              type="datetime-local"
                              value={currentOpensValue}
                              onChange={(e) =>
                                setSegmentOpensInputs((prev) => ({ ...prev, [seg.id]: e.target.value }))
                              }
                              onPaste={(e) => {
                                const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                                if (parsed) {
                                  e.preventDefault();
                                  setSegmentOpensInputs((prev) => ({ ...prev, [seg.id]: parsed }));
                                }
                              }}
                              className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                            />
                            <span className="text-[10px] text-slate-500">— hora de Paraguay</span>
                            <button
                              type="button"
                              onClick={() => handleSaveSegmentOpensAt(ev.id, seg.id)}
                              disabled={segmentOpenSavingId === seg.id}
                              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-700 transition"
                            >
                              {segmentOpenSavingId === seg.id ? "Guardando…" : "Guardar"}
                            </button>
                            {hasRealOpensAt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSegmentOpensInputs((prev) => ({ ...prev, [seg.id]: "" }));
                                  handleSaveSegmentOpensAt(ev.id, seg.id, "");
                                }}
                                disabled={segmentOpenSavingId === seg.id}
                                className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                              >
                                Quitar override
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSegmentManualOpen(ev.id, seg.id, !seg.manuallyOpened)
                              }
                              disabled={segmentOpenSavingId === seg.id}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition disabled:opacity-50 ${
                                seg.manuallyOpened
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                              }`}
                            >
                              {seg.manuallyOpened ? "🔓 Abierto a mano" : "Abrir ahora"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Hora de pista propia por segmento, para el calendario
                      (/calendario y /competitions/[id]). Vacío = el
                      calendario sigue usando la hora general del evento de
                      arriba, sin desglosar por segmento. El split Top N /
                      Resto es opcional y solo tiene sentido si el segmento
                      ya tiene su propia hora rellena. */}
                  {ev.segments && ev.segments.length > 0 && (
                    <div className="mt-3 space-y-2.5 bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Horario por segmento (calendario){" "}
                        <span className="font-normal normal-case text-slate-600">
                          — vacío = usa la hora general del evento, sin desglosar
                        </span>
                      </p>
                      {ev.segments.map((seg: any) => {
                        const scheduleKey = `${seg.id}:schedule`;
                        const scheduleLabelKey = `${seg.id}:scheduleLabel`;
                        const splitLabelKey = `${seg.id}:splitLabel`;
                        const splitScheduleKey = `${seg.id}:splitSchedule`;
                        const scheduleValue =
                          segmentScheduleInputs[scheduleKey] ??
                          (seg.scheduledAt
                            ? toDatetimeLocalValue(seg.scheduledAt)
                            : getRememberedValue(LAST_VALUE_KEYS.segmentSchedule));
                        const scheduleLabelValue =
                          segmentScheduleInputs[scheduleLabelKey] ?? seg.scheduleLabel ?? "";
                        const splitLabelValue = segmentScheduleInputs[splitLabelKey] ?? seg.splitLabel ?? "";
                        const splitScheduleValue =
                          segmentScheduleInputs[splitScheduleKey] ??
                          (seg.splitScheduledAt ? toDatetimeLocalValue(seg.splitScheduledAt) : "");
                        return (
                          <div key={seg.id} className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-300 font-semibold w-24 shrink-0">
                                {seg.name}
                              </span>
                              <input
                                type="datetime-local"
                                value={scheduleValue}
                                onChange={(e) =>
                                  setSegmentScheduleInputs((prev) => ({ ...prev, [scheduleKey]: e.target.value }))
                                }
                                onPaste={(e) => {
                                  const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                                  if (parsed) {
                                    e.preventDefault();
                                    setSegmentScheduleInputs((prev) => ({ ...prev, [scheduleKey]: parsed }));
                                  }
                                }}
                                className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                              />
                              <span className="text-[10px] text-slate-500">— hora de Paraguay</span>
                              <input
                                type="text"
                                placeholder="Etiqueta Ej. Less Top 10"
                                value={scheduleLabelValue}
                                onChange={(e) =>
                                  setSegmentScheduleInputs((prev) => ({
                                    ...prev,
                                    [scheduleLabelKey]: e.target.value,
                                  }))
                                }
                                className="w-32 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pl-[6.5rem]">
                              <span className="text-[10px] text-slate-500 shrink-0">Split (opcional):</span>
                              <input
                                type="text"
                                placeholder="Ej. Top 10"
                                value={splitLabelValue}
                                onChange={(e) =>
                                  setSegmentScheduleInputs((prev) => ({ ...prev, [splitLabelKey]: e.target.value }))
                                }
                                className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                              />
                              <input
                                type="datetime-local"
                                value={splitScheduleValue}
                                onChange={(e) =>
                                  setSegmentScheduleInputs((prev) => ({ ...prev, [splitScheduleKey]: e.target.value }))
                                }
                                onPaste={(e) => {
                                  const parsed = parsePastedDateTime(e.clipboardData.getData("text"));
                                  if (parsed) {
                                    e.preventDefault();
                                    setSegmentScheduleInputs((prev) => ({ ...prev, [splitScheduleKey]: parsed }));
                                  }
                                }}
                                className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSegmentSchedule(ev.id, seg.id)}
                                disabled={segmentScheduleSavingId === seg.id}
                                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-700 transition"
                              >
                                {segmentScheduleSavingId === seg.id ? "Guardando…" : "Guardar"}
                              </button>
                            </div>
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
                    isPrecision ? (
                      // Precisión: programa único con una sola plantilla fija
                      // (sin Corto/Largo ni formatos que elegir, a diferencia
                      // de Show), así que basta un botón.
                      <button
                        onClick={() => handleGenerateSlots(ev.id, "PROGRAMA", {})}
                        disabled={actionLoadingId === `${ev.id}-PROGRAMA`}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        {actionLoadingId === `${ev.id}-PROGRAMA` ? "Cargando..." : "⚡ Generar Slots"}
                      </button>
                    ) : isShow ? (
                      // Show no tiene Corto/Largo (un único programa) y el
                      // formato (Cuartetos/Grupos Pequeños/Grandes) ya se fija
                      // al crear/editar el evento (ev.showFormat), porque cada
                      // formato es en realidad una competición separada con su
                      // propia hora — así que basta un botón, igual que
                      // Precisión. Si el evento no tiene formato asignado
                      // todavía, la API responde con el error explicándolo.
                      <button
                        onClick={() => handleGenerateSlots(ev.id, "PROGRAMA", {})}
                        disabled={actionLoadingId === `${ev.id}-PROGRAMA` || !ev.showFormat}
                        title={!ev.showFormat ? "Edita el evento y elige antes un formato de Show" : undefined}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        {actionLoadingId === `${ev.id}-PROGRAMA` ? "Cargando..." : "⚡ Generar Slots"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleGenerateSlots(ev.id, "SHORT", { segment: "SHORT" })}
                          disabled={actionLoadingId === `${ev.id}-SHORT`}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          {actionLoadingId === `${ev.id}-SHORT` ? "Cargando..." : `⚡ Slots ${segmentLabels.short}`}
                        </button>

                        <button
                          onClick={() => handleGenerateSlots(ev.id, "LONG", { segment: "LONG" })}
                          disabled={actionLoadingId === `${ev.id}-LONG`}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          {actionLoadingId === `${ev.id}-LONG` ? "Cargando..." : `⚡ Slots ${segmentLabels.long}`}
                        </button>
                      </>
                    )
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
                )}
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