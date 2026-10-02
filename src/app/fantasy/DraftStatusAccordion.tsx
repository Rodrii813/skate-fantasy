"use client";

import Link from "next/link";
import { useState } from "react";

// Lista de disciplinas plegable: con una competición grande (varias
// categorías de edad × varias disciplinas, no solo las 4 de la referencia
// que trajo el usuario) mostrar todo desplegado de golpe se hacía
// interminable. Cada disciplina+género empieza plegada y se despliega al
// pulsarla — mismo criterio que los días de /calendario y los grupos de
// disciplina de /competitions.
//
// Dentro de una disciplina ya desplegada, cada PRUEBA (categoría de edad,
// p.ej. "Senior") es a su vez su propia fila plegable — empieza plegada,
// una debajo de otra (no en rejilla, para no ocupar tanto ancho con pocas
// pruebas). Al desplegar una prueba, sus segmentos (Corto y Largo) aparecen
// uno AL LADO DEL OTRO (en horizontal) y empiezan ya desplegados — se pueden
// volver a plegar individualmente, pero no hace falta un clic extra para
// verlos la primera vez. Cada segmento enseña tu equipo separado en ELEMENTS
// y COMPONENTS con la puntuación de cada patinador elegido, o un enlace
// "Tap to draft" si la prueba está abierta y todavía no has elegido nada.
//
// Todo el contenido (traducciones, estado de cada segmento, si el usuario
// actual ya tiene draft hecho, sus picks ya separados en Elements/Components)
// se calcula en el servidor (fantasy/page.tsx) y llega aquí ya resuelto; este
// componente solo decide qué está plegado.

export interface DraftStatusPick {
  slotId: string;
  slotLabel: string;
  skaterName: string;
  points: number | null; // null = todavía sin puntuación oficial publicada
}

export interface DraftStatusSegment {
  id: string;
  label: string;
  showLabel: boolean;
  state: "proximamente" | "abierto" | "cerrado";
  drafted: boolean;
  hasScores: boolean;
  total: number | null;
  // Tu equipo en este segmento, ya separado en Elements (técnica) y
  // Components — ver getSlotTypeByLabel en fantasyTemplates.ts. Vacíos si no
  // has hecho draft aquí todavía.
  elementPicks: DraftStatusPick[];
  componentPicks: DraftStatusPick[];
  href: string | null;
}

export interface DraftStatusEvent {
  id: string;
  categoryLabel: string;
  isTest: boolean;
  segments: DraftStatusSegment[];
}

export interface DraftStatusColumn {
  key: string;
  label: string;
  events: DraftStatusEvent[];
}

export interface DraftStatusLabels {
  openBadge: string;
  upcomingBadge: string;
  draftedBadge: string;
  notDraftedBadge: string;
  totalLabel: string;
  elementsLabel: string;
  componentsLabel: string;
  tapToDraft: string;
  goToEventLabel: string;
}

function PickRow({ pick }: { pick: DraftStatusPick }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px]">
      <div className="min-w-0">
        <p className="text-slate-500 truncate">{pick.slotLabel}</p>
        <p className="text-slate-300 font-semibold truncate">{pick.skaterName}</p>
      </div>
      <span className="shrink-0 font-mono font-bold text-slate-400">
        {pick.points === null ? "—" : pick.points.toFixed(2)}
      </span>
    </div>
  );
}

function SegmentCard({
  seg,
  isOpen,
  onToggle,
  labels,
}: {
  seg: DraftStatusSegment;
  isOpen: boolean;
  onToggle: () => void;
  labels: DraftStatusLabels;
}) {
  const hasBody = seg.elementPicks.length > 0 || seg.componentPicks.length > 0;
  const canExpand = hasBody || (seg.state === "abierto" && !seg.drafted && Boolean(seg.href));

  return (
    <div className="flex-1 min-w-[10rem] rounded-lg border border-slate-800 bg-slate-950/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        disabled={!canExpand}
        className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition ${
          canExpand ? "hover:bg-slate-800/40" : "cursor-default"
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {canExpand && (
            <span
              className={`shrink-0 text-[9px] text-slate-500 transition-transform ${isOpen ? "" : "-rotate-90"}`}
              aria-hidden="true"
            >
              ▾
            </span>
          )}
          {seg.showLabel && <span className="shrink-0 text-[10px] text-slate-500">{seg.label}</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {seg.state === "abierto" && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              {labels.openBadge}
            </span>
          )}
          {seg.state === "proximamente" ? (
            <span className="rounded-full border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {labels.upcomingBadge}
            </span>
          ) : (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                seg.drafted
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-slate-700 bg-slate-800/60 text-slate-400"
              }`}
            >
              {seg.drafted ? labels.draftedBadge : labels.notDraftedBadge}
            </span>
          )}
        </span>
      </button>

      {isOpen && hasBody && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/80">
          <div className="flex items-center justify-between px-2 py-1 text-[10px]">
            <span className="text-slate-500">{labels.totalLabel}</span>
            <span className="font-mono font-bold text-indigo-400">
              {seg.hasScores && seg.total !== null ? seg.total.toFixed(2) : "—"}
            </span>
          </div>
          {seg.elementPicks.length > 0 && (
            <div className="px-0 py-1">
              <p className="px-2 pb-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                {labels.elementsLabel}
              </p>
              {seg.elementPicks.map((pick) => (
                <PickRow key={pick.slotId} pick={pick} />
              ))}
            </div>
          )}
          {seg.componentPicks.length > 0 && (
            <div className="px-0 py-1">
              <p className="px-2 pb-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                {labels.componentsLabel}
              </p>
              {seg.componentPicks.map((pick) => (
                <PickRow key={pick.slotId} pick={pick} />
              ))}
            </div>
          )}
          {seg.href && (
            <Link
              href={seg.href}
              className="block px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-400 transition hover:bg-slate-800/40 hover:text-indigo-300"
            >
              {labels.goToEventLabel} →
            </Link>
          )}
        </div>
      )}

      {/* Sin picks todavía pero abierta: enlace directo para empezar a
          draftear, igual que la referencia ("Tap to draft"). */}
      {isOpen && !hasBody && seg.state === "abierto" && seg.href && (
        <Link
          href={seg.href}
          className="block border-t border-slate-800 px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-400 transition hover:bg-slate-800/40 hover:text-indigo-300"
        >
          ✏️ {labels.tapToDraft}
        </Link>
      )}
    </div>
  );
}

export default function DraftStatusAccordion({
  columns,
  labels,
}: {
  columns: DraftStatusColumn[];
  labels: DraftStatusLabels;
}) {
  // Disciplina activa: pestañas deslizables en horizontal (como el selector
  // de la referencia) en vez de un acordeón con TODAS las disciplinas
  // apiladas — con muchas disciplinas/categorías, tenerlas todas listadas
  // (aunque plegadas) seguía ocupando una fila por cada una. Ahora solo se
  // ve el contenido de UNA disciplina a la vez, debajo de la tira de
  // pestañas.
  const [activeKey, setActiveKey] = useState<string>(columns[0]?.key ?? "");
  // Pruebas (categorías) desplegadas — empiezan todas plegadas, una debajo
  // de otra.
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set());
  // Segmentos (Corto/Largo) que el usuario ha plegado A MANO: al desplegar
  // una prueba, sus segmentos aparecen ya desplegados por defecto (lado a
  // lado), así que aquí solo se guardan las excepciones manuales.
  const [closedSegments, setClosedSegments] = useState<Set<string>>(new Set());

  const activeColumn = columns.find((c) => c.key === activeKey) ?? columns[0];

  function toggleEvent(eventId: string) {
    setOpenEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  function toggleSegment(segmentId: string) {
    setClosedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  return (
    <div>
      {/* Pestañas de disciplina, deslizables en horizontal si no caben —
          solo la activa muestra su contenido debajo. */}
      <div className="flex gap-1.5 overflow-x-auto p-3 border-b border-slate-800">
        {columns.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => setActiveKey(col.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
              col.key === activeColumn?.key
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {col.label} <span className="font-normal normal-case opacity-60">({col.events.length})</span>
          </button>
        ))}
      </div>

      {activeColumn && (
        <div className="space-y-2 p-4">
          {activeColumn.events.map((ev) => {
            const isEventOpen = openEvents.has(ev.id);
            return (
              <div key={ev.id} className="rounded-xl border border-slate-800/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleEvent(ev.id)}
                  aria-expanded={isEventOpen}
                  className="flex w-full items-center justify-between gap-2 bg-slate-900/40 px-3 py-2 text-left transition hover:bg-slate-800/40"
                >
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
                    {ev.categoryLabel}
                    {ev.isTest && <span className="text-amber-400">🧪</span>}
                  </span>
                  <span
                    className={`text-[10px] text-slate-500 transition-transform ${
                      isEventOpen ? "" : "-rotate-90"
                    }`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {isEventOpen && (
                  <div className="flex flex-wrap gap-2 p-2">
                    {ev.segments.map((seg) => (
                      <SegmentCard
                        key={seg.id}
                        seg={seg}
                        isOpen={!closedSegments.has(seg.id)}
                        onToggle={() => toggleSegment(seg.id)}
                        labels={labels}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
