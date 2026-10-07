"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  validateFantasyRoster,
  isComponentSlotLabel,
  isSmallField,
  SMALL_FIELD_TECH_REPEATS,
} from "@/lib/fantasyValidation";
import LocalDateTime from "@/app/_components/LocalDateTime";
import SkaterSearchSelect, { type SkaterSearchGroup } from "@/app/_components/SkaterSearchSelect";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

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
  // `locked` cubre DOS casos que se tratan igual de cara a bloquear la
  // edición: el plazo ya cerró, o el segmento todavía no se ha abierto
  // (opensAt futuro y sin abrir a mano) — ver src/lib/segments.ts. `upcoming`
  // distingue el segundo caso solo para mostrar el mensaje correcto.
  locked: boolean;
  upcoming?: boolean;
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
  // Pestaña con la que abrir el formulario (p.ej. llegando desde una fila
  // del calendario que apuntaba específicamente al Largo/Freedance, no al
  // Corto por defecto). Si no coincide con ningún segmento real, se ignora
  // y se abre en el primero, como siempre.
  initialSegmentId?: string;
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
  initialSegmentId,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const dict = getDictionary(locale);
  const t = dict.fantasyRoster;
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
          upcoming: false,
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
      upcoming: seg.upcoming,
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

  const [activeTabId, setActiveTabId] = useState(
    (initialSegmentId && tabs.some((t) => t.id === initialSegmentId) ? initialSegmentId : tabs[0]?.id) ??
      DEFAULT_TAB_ID
  );
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

  // Autodraft: SOLO se dispara al pulsar el botón (nunca automático al
  // cerrar el plazo ni en segundo plano) — rellena de golpe el segmento
  // ACTIVO con una combinación al azar que ya cumple las normas de
  // src/lib/fantasyValidation.ts, para quien no quiera elegir a mano. En vez
  // de reimplementar las reglas de grupo aquí (duplicando lo que ya vive en
  // esa validación, con el riesgo de que se desincronicen), se generan
  // candidatos al azar con un reparto "inteligente" (evita repetir
  // patinadora en técnicos, evita pasarse de 2 por grupo top/segundo top,
  // evita repetir grupo en Componentes cuando la norma aplica) y se valida
  // cada uno con la MISMA función que usa el botón de Guardar; el primero
  // que sale válido es el que se aplica. Sobrescribe los picks del segmento
  // activo — los de otros segmentos (p.ej. el Largo si estás en el Corto) no
  // se tocan.
  const handleAutodraft = () => {
    if (!activeTab || activeTab.locked) return;
    if (activeSlots.length === 0) return;

    const groupField = activeTab.groupField;
    const pool = registrations.map((r) => ({ skaterId: r.skaterId, group: r[groupField] || 1 }));
    const groupNums = Array.from(new Set(pool.map((r) => r.group))).sort((a, b) => b - a);
    const maxGroupNum = groupNums[0] ?? 1;
    const secondMaxGroupNum = groupNums[1] ?? 0;
    // Mismo umbral que fantasyValidation.ts: con 2 grupos o menos, las
    // normas de grupo no aplican (si no, categorías pequeñas nunca podrían
    // completarse).
    const smallField = isSmallField(pool.length);
    const hasEnoughGroupsForRule = groupNums.length > 2 && !smallField;

    const buildCandidate = (): Record<string, string> => {
      const candidate: Record<string, string> = { ...picks };

      const techPool = [...pool].sort(() => Math.random() - 0.5);
      const usedTechSkaters = new Set<string>();
      const techUses: Record<string, number> = {};
      const techGroupCount: Record<number, number> = {};
      for (const slot of technicalSlots) {
        const idx = techPool.findIndex((r) => {
          if (smallField) return (techUses[r.skaterId] || 0) < SMALL_FIELD_TECH_REPEATS;
          if (usedTechSkaters.has(r.skaterId)) return false;
          if (!hasEnoughGroupsForRule) return true;
          if (r.group === maxGroupNum && (techGroupCount[maxGroupNum] || 0) >= 2) return false;
          if (secondMaxGroupNum && r.group === secondMaxGroupNum && (techGroupCount[secondMaxGroupNum] || 0) >= 2) {
            return false;
          }
          return true;
        });
        if (idx === -1) continue;
        // Con pocas patinadoras cada una puede volver a salir (hasta 2 veces).
        const chosen = smallField ? techPool[idx] : techPool.splice(idx, 1)[0];
        candidate[slot.id] = chosen.skaterId;
        usedTechSkaters.add(chosen.skaterId);
        techUses[chosen.skaterId] = (techUses[chosen.skaterId] || 0) + 1;
        techGroupCount[chosen.group] = (techGroupCount[chosen.group] || 0) + 1;
      }

      const compPool = [...pool].sort(() => Math.random() - 0.5);
      const usedCompGroups = new Set<number>();
      for (const slot of componentSlots) {
        const idx = compPool.findIndex((r) => (hasEnoughGroupsForRule ? !usedCompGroups.has(r.group) : true));
        if (idx === -1) continue;
        const [chosen] = compPool.splice(idx, 1);
        candidate[slot.id] = chosen.skaterId;
        if (hasEnoughGroupsForRule) usedCompGroups.add(chosen.group);
      }

      return candidate;
    };

    const segmentsForValidation =
      orderedSegments.length > 0 ? orderedSegments : [{ id: DEFAULT_TAB_ID, order: 0 }];
    const registrationsForValidation = registrations.map((r) => ({
      skaterId: r.skaterId,
      warmupGroupShort: r.warmupGroupShort,
      warmupGroupLong: r.warmupGroupLong,
    }));

    let bestCandidate: Record<string, string> | null = null;
    let bestErrorMessage = "";

    // Pocos slots y grupos (categorías de patinaje, no miles de opciones), así
    // que 200 intentos al azar son prácticamente instantáneos y encuentran
    // una combinación válida casi siempre que exista una; si la categoría es
    // tan pequeña que ninguna combinación cumple las normas, se avisa en vez
    // de dejar algo a medias.
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidate = buildCandidate();
      const result = validateFantasyRoster({
        slots,
        registrations: registrationsForValidation,
        segments: segmentsForValidation,
        picks: candidate,
      });
      const segResult = result.segments.find((s) => s.segmentId === activeTab.id);
      if (segResult?.valid) {
        bestCandidate = candidate;
        break;
      }
      if (!bestErrorMessage && segResult?.errorMessage) bestErrorMessage = segResult.errorMessage;
    }

    if (bestCandidate) {
      setPicks(bestCandidate);
      setMsg({ type: "success", text: t.autodraftSuccess });
    } else {
      setMsg({ type: "error", text: bestErrorMessage || t.autodraftFailed });
    }
  };

  const handleSave = async () => {
    // OJO: antes se comprobaba `validationResult.valid` (TODOS los
    // segmentos a la vez), pero el botón solo se habilita mirando el
    // segmento activo (`activeSegmentValidation`, ver el `disabled` más
    // abajo). Si el usuario tenía el Corto completo (botón en azul) pero el
    // Largo todavía sin rellenar, este `return` se disparaba en silencio:
    // no se abría `saving`, no se ponía ningún mensaje, no pasaba nada
    // visible. La API igualmente solo guarda los slots del segmento abierto
    // que se le mande, así que basta con validar el segmento activo aquí.
    if (!activeSegmentValidation?.valid) return;
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
      if (!res.ok) throw new Error(data.error || t.saveError);

      setMsg({ type: "success", text: t.saveSuccess });
      router.refresh();
    } catch (err: any) {
      setMsg({ type: "error", text: `❌ ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const renderSlotSelect = (slot: Slot, ringColor: string) => {
    const currentSkaterId = picks[slot.id] || "";
    const groups: SkaterSearchGroup[] = groupedRegistrations.map(({ group, skaters }) => ({
      label: t.warmupGroupHeader(group),
      options: skaters.map((reg) => ({
        id: reg.skater.id,
        firstName: reg.skater.firstName,
        lastName: reg.skater.lastName,
        country: reg.skater.country,
      })),
    }));
    return (
      <SkaterSearchSelect
        key={slot.id}
        value={currentSkaterId}
        onChange={(skaterId) => handleSelect(slot.id, skaterId)}
        groups={groups}
        placeholder={t.selectSkater(slot.label)}
        searchPlaceholder={dict.common.searchSkaters}
        noResultsLabel={dict.common.noSkatersFound}
        ringColorClass={ringColor}
      />
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <span className="text-xs text-slate-400 font-semibold">
          {t.deadline} {activeTab?.name ? `(${activeTab.name})` : ""}:{" "}
          <LocalDateTime
            value={activeTab?.locksAt ?? rosterLocksAt}
            options={{ dateStyle: "medium", timeStyle: "short" }}
          />
          {activeTab?.locked && (
            <span className="ml-2 text-amber-400 font-bold">
              {activeTab.upcoming ? t.notYetOpen : t.closed}
            </span>
          )}
        </span>
        <h1 className="text-xl font-black text-slate-100 mt-1">
          {t.formTitle}
        </h1>
        <a
          href="/fantasy/normas"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-[11px] text-indigo-400 underline hover:text-indigo-300"
        >
          {t.viewRules}
        </a>
        <a
          href={`/fantasy/${eventId}/leaderboard`}
          className="mt-1 ml-3 inline-block text-[11px] text-amber-400 underline hover:text-amber-300"
        >
          {t.liveRanking}
        </a>
      </div>

      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-4 space-y-1">
        <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{t.howToPlayTitle}</h2>
        <p className="text-xs text-slate-300 leading-relaxed">{t.howToPlayBody}</p>
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
          {t.noSlots(activeTab?.name || t.defaultSegment)}
        </div>
      ) : activeTab?.locked && activeTab.upcoming ? (
        // Segmento con slots ya generados pero que todavía no se ha
        // abierto (opensAt futuro y sin abrir a mano) — p.ej. el Largo,
        // preparado con antelación pero que no debe poder tocarse hasta
        // que se sepa el resultado del Corto. No se muestra nada de la
        // lista de picks todavía, solo el aviso.
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">{t.segmentUpcoming(activeTab.name)}</p>
        </div>
      ) : activeTab?.locked ? (
        // Segmento cerrado: solo lectura. No se muestran los <select> — el
        // usuario ya no puede tocar estos picks, aunque otro segmento del
        // mismo evento (p.ej. el Largo) pueda seguir abierto en su propia
        // pestaña.
        <div className="space-y-4">
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 text-xs text-amber-300 font-semibold">
            {t.segmentLocked(activeTab.name)}
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
                      : t.unassigned}
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
              {t.technicalRulesTitle(activeTab?.name ?? "")}
            </h2>
            {activeSegmentValidation?.smallField ? (
              <div className="space-y-1 text-xs text-slate-300">
                <p className="flex items-center gap-1.5 font-medium">
                  <span>⚠️</span> {t.ruleSmall1}
                </p>
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="opacity-0">⚠️</span> {t.ruleSmall2}
                </p>
              </div>
            ) : (
              <>
            <div className="space-y-1 text-xs text-slate-300">
              <p className="flex items-center gap-1.5 font-medium">
                <span>⚠️</span> {t.rule1}
              </p>
              <p className="flex items-center gap-1.5 font-medium">
                <span className="opacity-0">⚠️</span> {t.rule2}
              </p>
              <p className="pl-5 text-[11px] text-slate-400 italic">{t.warmupGroupHint}</p>
            </div>

              </>
            )}

            {activeSegmentValidation && !activeSegmentValidation.smallField && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    {t.warmupGroup} {activeSegmentValidation.maxGroupNum}:
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
                      {t.warmupGroup} {activeSegmentValidation.secondMaxGroupNum}:
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
                {t.componentRulesTitle}
              </h2>
              <p className="text-xs text-slate-300">
                ⭐ <strong>{t.maxOnePerGroup}:</strong> {t.componentRuleBody}
              </p>
            </div>
          </div>

          {/* 1. SECCIÓN ELEMENTOS TÉCNICOS */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              {t.technicalElements}
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
                {t.programComponents}
              </h2>
              {componentSlots.map((slot) => (
                <div key={slot.id} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-200 tracking-wide">
                      {slot.label}
                    </label>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-900">
                      {t.maxOnePerGroup}
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
      {!activeTab?.locked && activeSlots.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={handleAutodraft}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.autodraft}
          </button>
          <p className="text-center text-[11px] text-slate-500">{t.autodraftHint}</p>
        </div>
      )}

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
              ? t.saving
              : activeSegmentValidation?.valid
              ? t.saveOfficial
              : activeSegmentValidation?.errorMessage || t.completeRoster}
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
