"use client";

import Link from "next/link";
import { useState } from "react";

// Lista de disciplinas plegable, en vez de la fila de columnas de antes: con
// una competición grande (varias categorías de edad × varias disciplinas,
// no solo las 4 de referencias como RockerLive) mostrar todo desplegado de
// golpe se hacía interminable. Cada disciplina+género empieza plegada y se
// despliega al pulsarla — mismo criterio que los días de /calendario y los
// grupos de disciplina de /competitions.
//
// Dentro de cada disciplina, cada prueba+segmento es a su vez su propia
// tarjeta plegable (empieza cerrada): la cabecera siempre visible enseña el
// estado y tu puntuación total, y al pulsarla se despliega tu equipo
// completo — igual que la referencia, pero con un nivel más de plegado
// porque aquí hay muchas más pruebas que en la referencia.
//
// Todo el contenido (traducciones, estado de cada segmento, si el usuario
// actual ya tiene draft hecho) se calcula en el servidor (fantasy/page.tsx)
// y llega aquí ya resuelto; este componente solo decide qué está plegado.

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
  badgeLabel: string;
  badgeClassName: string;
  drafted: boolean;
  draftedText: string | null;
  href: string | null;
  // Tu equipo en este segmento, ya resuelto en el servidor — null si no has
  // hecho draft aquí todavía. Se muestra directamente al desplegar la
  // disciplina (sin un toggle aparte), igual que en la referencia.
  myPicks: DraftStatusPick[] | null;
  myTotal: number | null;
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

export default function DraftStatusAccordion({
  columns,
  expandAllLabel,
  collapseAllLabel,
  goToEventLabel,
}: {
  columns: DraftStatusColumn[];
  expandAllLabel: string;
  collapseAllLabel: string;
  // Texto del enlace que, dentro de una tarjeta de prueba ya desplegada,
  // lleva al Draft Room de esa prueba+segmento concretos.
  goToEventLabel: string;
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
                        const hasPicks = seg.myPicks && seg.myPicks.length > 0;
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
                              disabled={!hasPicks}
                              className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition ${
                                hasPicks ? "hover:bg-slate-800/40" : "cursor-default"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                {hasPicks && (
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
                              <span className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${seg.badgeClassName}`}
                                >
                                  {seg.badgeLabel}
                                </span>
                                {seg.myTotal !== null ? (
                                  <span className="text-[11px] font-bold text-indigo-400">
                                    {seg.myTotal.toFixed(2)}
                                  </span>
                                ) : (
                                  seg.draftedText && (
                                    <span
                                      className={`text-[11px] font-semibold ${
                                        seg.drafted ? "text-indigo-400" : "text-slate-500"
                                      }`}
                                    >
                                      {seg.draftedText}
                                    </span>
                                  )
                                )}
                              </span>
                            </button>

                            {/* Tu equipo ya elegido en este segmento: ahora
                                oculto hasta que se pulsa la propia tarjeta
                                (antes se enseñaba siempre al desplegar la
                                disciplina entera). */}
                            {isSegOpen && hasPicks && (
                              <div className="border-t border-slate-800 divide-y divide-slate-800/80">
                                {seg.myPicks!.map((pick) => (
                                  <div
                                    key={pick.slotId}
                                    className="flex items-center justify-between gap-2 px-2 py-1 text-[10px]"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-slate-500 truncate">{pick.slotLabel}</p>
                                      <p className="text-slate-300 font-semibold truncate">{pick.skaterName}</p>
                                    </div>
                                    <span className="shrink-0 font-mono font-bold text-slate-400">
                                      {pick.points === null ? "—" : pick.points.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                                {seg.href && (
                                  <Link
                                    href={seg.href}
                                    className="block px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-400 transition hover:bg-slate-800/40 hover:text-indigo-300"
                                  >
                                    {goToEventLabel} →
                                  </Link>
                                )}
                              </div>
                            )}

                            {/* Sin picks todavía: la cabecera no se puede
                                desplegar (no hay nada que enseñar), pero si
                                la prueba está abierta se enlaza directo al
                                Draft Room para empezar a draftear. */}
                            {!hasPicks && seg.href && (
                              <Link
                                href={seg.href}
                                className="block border-t border-slate-800 px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-400 transition hover:bg-slate-800/40 hover:text-indigo-300"
                              >
                                {goToEventLabel} →
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
