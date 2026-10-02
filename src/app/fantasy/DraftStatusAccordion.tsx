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
// Dentro de cada disciplina, cada prueba+segmento es a su vez su propia
// tarjeta plegable (calcada de la referencia: cabecera con el estado
// "OPEN"/nada y "Drafted"/"Not drafted", y al desplegarla tu equipo completo
// separado en ELEMENTS y COMPONENTS con la puntuación de cada patinador
// elegido, o un enlace "Tap to draft" si la prueba está abierta y todavía no
// has elegido nada).
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

export default function DraftStatusAccordion({
  columns,
  expandAllLabel,
  collapseAllLabel,
  labels,
}: {
  columns: DraftStatusColumn[];
  expandAllLabel: string;
  collapseAllLabel: string;
  labels: DraftStatusLabels;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(columns.map((c) => c.key)));
  // Plegado independiente para cada tarjeta de prueba+segmento (segundo
  // nivel, dentro de una disciplina ya desplegada). Todas empiezan cerradas.
  const [openSegments, setOpenSegments] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSegment(segmentId: string) {
    setOpenSegments((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 p-3 border-b border-slate-800 text-[11px]">
        <button
          type="button"
          onClick={() => setCollapsed(new Set())}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
        >
          {expandAllLabel}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(columns.map((c) => c.key)))}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
        >
          {collapseAllLabel}
        </button>
      </div>

      <div className="divide-y divide-slate-800">
        {columns.map((col) => {
          const isCollapsed = collapsed.has(col.key);
          return (
            <div key={col.key}>
              <button
                type="button"
                onClick={() => toggle(col.key)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-800/30"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {col.label}{" "}
                  <span className="ml-1 font-normal normal-case text-slate-500">
                    ({col.events.length})
                  </span>
                </span>
                <span
                  className={`text-sm text-slate-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {!isCollapsed && (
                <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                  {col.events.map((ev) => (
                    <div key={ev.id} className="space-y-1">
                      <p className="truncate text-[11px] uppercase tracking-wide text-slate-500">
                        {ev.categoryLabel}
                        {ev.isTest && <span className="ml-1 text-amber-400">🧪</span>}
                      </p>
                      {ev.segments.map((seg) => {
                        const hasBody = seg.elementPicks.length > 0 || seg.componentPicks.length > 0;
                        const isSegOpen = openSegments.has(seg.id);
                        return (
                          <div
                            key={seg.id}
                            className="rounded-lg border border-slate-800 bg-slate-950/40 overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSegment(seg.id)}
                              aria-expanded={isSegOpen}
                              disabled={!hasBody}
                              className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition ${
                                hasBody ? "hover:bg-slate-800/40" : "cursor-default"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                {hasBody && (
                                  <span
                                    className={`shrink-0 text-[9px] text-slate-500 transition-transform ${
                                      isSegOpen ? "" : "-rotate-90"
                                    }`}
                                    aria-hidden="true"
                                  >
                                    ▾
                                  </span>
                                )}
                                {seg.showLabel && (
                                  <span className="shrink-0 text-[10px] text-slate-500">{seg.label}</span>
                                )}
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

                            {/* Tu equipo ya elegido en este segmento, separado
                                en Elements y Components — oculto hasta que se
                                pulsa la propia tarjeta. */}
                            {isSegOpen && hasBody && (
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

                            {/* Sin picks todavía pero abierta: enlace directo
                                para empezar a draftear, igual que la
                                referencia ("✏️ Tap to draft"). Si está
                                cerrada o próximamente y no hay picks, no hay
                                nada más que mostrar. */}
                            {!hasBody && seg.state === "abierto" && seg.href && (
                              <Link
                                href={seg.href}
                                className="block border-t border-slate-800 px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-400 transition hover:bg-slate-800/40 hover:text-indigo-300"
                              >
                                ✏️ {labels.tapToDraft}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
