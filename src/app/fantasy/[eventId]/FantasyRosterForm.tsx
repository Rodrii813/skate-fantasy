"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { validateFantasyRoster, isComponentSlotLabel } from "@/lib/fantasyValidation";
import LocalDateTime from "@/app/_components/LocalDateTime";

interface Skater {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
}

interface Registration {
  skaterId: string;
  startOrder: number | null;
  warmupGroupShort: number | null;
  warmupGroupLong: number | null;
  skater: Skater;
}

interface Slot {
  id: string;
  label: string;
  order: number;
  segmentId: string | null;
}

interface Segment {
  id: string;
  name: string;
  order: number;
  // Plazo efectivo (ya resuelto en el servidor: el propio del segmento, o
  // el general del evento si no tiene uno) y si ya está cerrado — ver
  // src/lib/segments.ts. Calculado en el servidor para que SSR e
  // hidratación vean siempre el mismo "ahora".
  locksAt: string;
  locked: boolean;
}

interface Props {
  eventId: string;
  eventName: string;
  rosterLocksAt: string;
  // Si el evento no tiene segmentos configurados (caso legado), se usa este
  // flag para bloquear/desbloquear la única pestaña "Roster".
  eventLocked?: boolean;
  segments: Segment[];
  slots: Slot[];
  registrations: Registration[];
  initialPicks: Record<string, string>;
}

const DEFAULT_TAB_ID = "__default__";

export default function FantasyRosterForm({
  eventId,
  eventName,
  rosterLocksAt,
  eventLocked = false,
  segments,
  slots,
  registrations,
  initialPicks,
}: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Segmentos del evento en orden real de competición (Corto primero). Si el
  // evento no tiene segmentos configurados todavía, todos los slots caen en
  // una única pestaña "Roster" (comportamiento anterior a esta feature).
  const orderedSegments = useMemo(() => [...segments].sort((a, b) => a.order - b.order), [segments]);

  const tabs = useMemo(() => {
    if (orderedSegments.length === 0) {
      return [
        {
          id: DEFAULT_TAB_ID,
          name: "Roster",
          order: 0,
          groupField: "warmupGroupShort" as const,
          locksAt: rosterLocksAt,
          locked: eventLocked,
        },
      ];
    }
    return orderedSegments.map((seg, index) => ({
      id: seg.id,
      name: seg.name,
      order: seg.order,
      // El Corto (primer segmento) usa warmupGroupShort; cualquier otro
      // segmento (el Largo) usa warmupGroupLong — mismo criterio que
      // src/lib/fantasyValidation.ts.
      groupField: (index === 0 ? "warmupGroupShort" : "warmupGroupLong") as
        | "warmupGroupShort"
        | "warmupGroupLong",
      locksAt: seg.locksAt,
      locked: seg.locked,
    }));
  }, [orderedSegments, rosterLocksAt, eventLocked]);

  const slotsByTab = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const tab of tabs) map.set(tab.id, []);
    const fallbackTabId = tabs[0]?.id ?? DEFAULT_TAB_ID;
    for (const slot of slots) {
      const tabId = slot.segmentId && map.has(slot.segmentId) ? slot.segmentId : fallbackTabId;
      map.get(tabId)?.push(slot);
    }
    return map;
  }, [slots, tabs]);

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? DEFAULT_TAB_ID);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeSlots = slotsByTab.get(activeTab?.id ?? DEFAULT_TAB_ID) ?? [];

  const technicalSlots = useMemo(
    () => activeSlots.filter((s) => !isComponentSlotLabel(s.label)),
    [activeSlots]
  );
  const componentSlots = useMemo(
    () => activeSlots.filter((s) => isComponentSlotLabel(s.label)),
    [activeSlots]
  );

  // Agrupar registros por Warmup Group en orden ASCENDENTE (Grupo 1 primero,
  // que es quien sale a patinar primero), usando el campo de grupo que
  // corresponde a la pestaña activa (Corto/Largo tienen sorteos distintos).
  // Antes se ordenaba al revés (b - a) y el picker mostraba el último grupo
  // de calentamiento arriba del todo, en vez del orden real de salida.
  const groupedRegistrations = useMemo(() => {
    const groupField = activeTab?.groupField ?? "warmupGroupShort";
    const groups: Record<number, Registration[]> = {};
    for (const reg of registrations) {
      const g = reg[groupField] || 1;
      if (!groups[g]) groups[g] = [];
      groups[g].push(reg);
    }

    for (const g in groups) {
      groups[g].sort((a, b) => (a.startOrder || 0) - (b.startOrder || 0));
    }

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((groupNum) => ({
        group: groupNum,
        skaters: groups[groupNum],
      }));
  }, [registrations, activeTab]);

  // Validación de reglas — vive en src/lib/fantasyValidation.ts para que la
  // misma lógica la aplique también /api/fantasy/roster en el servidor, y
  // así no sea posible saltarse las normas evitando este formulario. Se
  // aplica de forma independiente por segmento (Corto y Largo tienen su
  // propio sorteo de grupos de calentamiento).
  const validationResult = useMemo(
    () =>
      validateFantasyRoster({
        slots,
        registrations: registrations.map((r) => ({
          skaterId: r.skaterId,
          warmupGroupShort: r.warmupGroupShort,
          warmupGroupLong: r.warmupGroupLong,
        })),
        segments: orderedSegments.length > 0 ? orderedSegments : [{ id: DEFAULT_TAB_ID, order: 0 }],
        picks,
      }),
    [slots, registrations, orderedSegments, picks]
  );

  const activeSegmentValidation = validationResult.segments.find((s) => s.segmentId === activeTab?.id);

  const handleSelect = (slotId: string, skaterId: string) => {
    setPicks((prev) => ({
      ...prev,
      [slotId]: skaterId,
    }));
  };

  const handleSave = async () => {
    if (!validationResult.valid) return;
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/fantasy/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          // Un único roster con los picks de TODOS los segmentos juntos.
          picks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el equipo");

      setMsg({ type: "success", text: "✅ ¡Alineación guardada con éxito!" });
      router.refresh();
    } catch (err: any) {
      setMsg({ type: "error", text: `❌ ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const renderSlotSelect = (slot: Slot, ringColor: string) => {
    const currentSkaterId = picks[slot.id] || "";
    return (
      <div key={slot.id} className="relative">
        <select
          value={currentSkaterId}
          onChange={(e) => handleSelect(slot.id, e.target.value)}
          className={`w-full bg-[#0d162e] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-xl p-3 appearance-none focus:outline-none focus:ring-1 ${ringColor} transition`}
        >
          <option value="">Select skater for {slot.label}</option>
          {groupedRegistrations.map(({ group, skaters }) => (
            <optgroup key={group} label={`── Warmup Group ${group} ──`}>
              {skaters.map((reg) => (
                <option key={reg.skater.id} value={reg.skater.id}>
                  {reg.skater.firstName} {reg.skater.lastName}
                  {reg.skater.country ? ` (${reg.skater.country})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
          ▼
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <span className="text-xs text-slate-400 font-semibold">
          Deadline {activeTab?.name ? `(${activeTab.name})` : ""}:{" "}
          <LocalDateTime
            value={activeTab?.locksAt ?? rosterLocksAt}
            options={{ dateStyle: "medium", timeStyle: "short" }}
          />
          {activeTab?.locked && (
            <span className="ml-2 text-amber-400 font-bold">🔒 Cerrado</span>
          )}
        </span>
        <h1 className="text-xl font-black text-slate-100 mt-1">
          Technical Elements & Components: Draft Constraints
        </h1>
        <a
          href="/fantasy/normas"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-[11px] text-indigo-400 underline hover:text-indigo-300"
        >
          Ver normas completas del Fantasy →
        </a>
        <a
          href={`/fantasy/${eventId}/leaderboard`}
          className="mt-1 ml-3 inline-block text-[11px] text-amber-400 underline hover:text-amber-300"
        >
          🏆 Clasificación en vivo →
        </a>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold ${
            msg.type === "success"
              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
              : "bg-red-950/60 text-red-300 border border-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Pestañas por segmento (Corto / Largo) */}
      {tabs.length > 1 && (
        <div className="flex gap-2 border-b border-slate-800">
          {tabs.map((tab) => {
            const segValid = validationResult.segments.find((s) => s.segmentId === tab.id)?.valid;
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-b-2 -mb-px ${
                  isActive
                    ? "border-indigo-500 text-indigo-300 bg-[#0b1329]"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.name} {tab.locked ? "🔒" : segValid === false ? "⚠️" : segValid === true ? "✅" : ""}
              </button>
            );
          })}
        </div>
      )}

      {activeSlots.length === 0 ? (
        <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 text-center">
          Todavía no hay slots generados para {activeTab?.name || "este segmento"}.
        </div>
      ) : activeTab?.locked ? (
        // Segmento cerrado: solo lectura. No se muestran los <select> — el
        // usuario ya no puede tocar estos picks, aunque otro segmento del
        // mismo evento (p.ej. el Largo) pueda seguir abierto en su propia
        // pestaña.
        <div className="space-y-4">
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 text-xs text-amber-300 font-semibold">
            🔒 El plazo de {activeTab.name} ya ha cerrado. Esta alineación queda fijada.
          </div>
          <div className="space-y-3">
            {activeSlots.map((slot) => {
              const skaterId = picks[slot.id];
              const reg = registrations.find((r) => r.skaterId === skaterId);
              return (
                <div
                  key={slot.id}
                  className="bg-[#0b1329] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <span className="text-xs font-bold text-slate-300">{slot.label}</span>
                  <span className="text-xs text-slate-400">
                    {reg
                      ? `${reg.skater.firstName} ${reg.skater.lastName}${
                          reg.skater.country ? ` (${reg.skater.country})` : ""
                        }`
                      : "— sin asignar —"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Reglas + contadores del segmento activo */}
          <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Normas Técnicas (Technical Elements) — {activeTab?.name}
            </h2>
            <div className="space-y-1 text-xs text-slate-300">
              <p className="flex items-center gap-1.5 font-medium">
                <span>⚠️</span> 1) Max 1 element per skater
              </p>
              <p className="flex items-center gap-1.5 font-medium">
                <span className="opacity-0">⚠️</span> 2) Max 2 elements in last 2 warmup groups
              </p>
            </div>

            {activeSegmentValidation && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    Warmup Group {activeSegmentValidation.maxGroupNum}:
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                      activeSegmentValidation.exceedsTopTech
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {activeSegmentValidation.countTopGroup}/2
                  </span>
                </div>

                {activeSegmentValidation.secondMaxGroupNum > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">
                      Warmup Group {activeSegmentValidation.secondMaxGroupNum}:
                    </span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                        activeSegmentValidation.exceedsSecondTech
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      {activeSegmentValidation.countSecondGroup}/2
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Reglas Componentes */}
            <div className="pt-2 border-t border-slate-800/80">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                Normas de Componentes (Program Components)
              </h2>
              <p className="text-xs text-slate-300">
                ⭐ <strong>Max 1 element per warmup group:</strong> Cada componente debe ser de un
                grupo distinto. Puedes repetir patinadoras de la parte técnica.
              </p>
            </div>
          </div>

          {/* 1. SECCIÓN ELEMENTOS TÉCNICOS */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              Technical Elements
            </h2>
            {technicalSlots.map((slot) => (
              <div key={slot.id} className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 tracking-wide">
                  {slot.label}
                </label>
                {renderSlotSelect(slot, "focus:ring-indigo-500")}
              </div>
            ))}
          </div>

          {/* 2. SECCIÓN PROGRAM COMPONENTS */}
          {componentSlots.length > 0 && (
            <div className="space-y-4 pt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-2">
                Program Components
              </h2>
              {componentSlots.map((slot) => (
                <div key={slot.id} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-200 tracking-wide">
                      {slot.label}
                    </label>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-900">
                      Max 1 por grupo
                    </span>
                  </div>
                  {renderSlotSelect(slot, "focus:ring-emerald-500")}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Botón y estado — solo si el segmento activo sigue abierto. Se
          guarda con el estado `picks` completo (todos los segmentos), pero
          la API solo escribe los slots de segmentos abiertos e ignora el
          resto, así que basta con un único botón aunque haya varios
          segmentos y alguno ya esté cerrado. */}
      {!activeTab?.locked && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !activeSegmentValidation?.valid}
            className={`w-full py-3.5 rounded-xl text-xs font-bold transition shadow-lg ${
              activeSegmentValidation?.valid
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700/50"
            }`}
          >
            {saving
              ? "Guardando..."
              : activeSegmentValidation?.valid
              ? "Guardar Alineación Oficial"
              : activeSegmentValidation?.errorMessage || "Completa la alineación"}
          </button>
          {!activeSegmentValidation?.valid && (
            <p className="text-center text-[11px] text-amber-400 font-medium">
              ℹ️ {activeSegmentValidation?.errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
