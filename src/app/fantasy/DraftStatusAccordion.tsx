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
// Todo el contenido (traducciones, estado de cada segmento, si el usuario
// actual ya tiene draft hecho) se calcula en el servidor (fantasy/page.tsx)
// y llega aquí ya resuelto; este componente solo decide qué está plegado.

export interface DraftStatusSegment {
  id: string;
  label: string;
  showLabel: boolean;
  badgeLabel: string;
  badgeClassName: string;
  drafted: boolean;
  draftedText: string | null;
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

export default function DraftStatusAccordion({
  columns,
  expandAllLabel,
  collapseAllLabel,
}: {
  columns: DraftStatusColumn[];
  expandAllLabel: string;
  collapseAllLabel: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(columns.map((c) => c.key)));

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
                        const content = (
                          <div className="flex items-center justify-between gap-2">
                            {seg.showLabel && (
                              <span className="shrink-0 text-[10px] text-slate-500">{seg.label}</span>
                            )}
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${seg.badgeClassName}`}
                            >
                              {seg.badgeLabel}
                            </span>
                            {seg.draftedText && (
                              <span
                                className={`text-[11px] font-semibold ${
                                  seg.drafted ? "text-indigo-400" : "text-slate-500"
                                }`}
                              >
                                {seg.draftedText}
                              </span>
                            )}
                          </div>
                        );

                        return seg.href ? (
                          <Link key={seg.id} href={seg.href} className="block transition hover:opacity-80">
                            {content}
                          </Link>
                        ) : (
                          <div key={seg.id}>{content}</div>
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
