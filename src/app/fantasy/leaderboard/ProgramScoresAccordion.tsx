"use client";

import { useState } from "react";
import type { RosterScore } from "@/lib/scoring";
import PaginatedRosterList from "@/app/fantasy/PaginatedRosterList";
import { LockedNotice, EmptyNotice, PendingScoresNotice } from "@/app/fantasy/LeaderboardNotices";

// Misma idea que DraftStatusAccordion (acordeón por disciplina+género, para
// no enseñar de golpe todas las categorías de una competición grande), pero
// aquí cada segmento no muestra un badge de estado sino la clasificación
// completa de esa categoría+segmento: bloqueada hasta que cierre el plazo,
// vacía si nadie ha hecho draft, pendiente si cerró pero el admin no ha
// subido resultados, o la lista paginada de rivales (PaginatedRosterList, la
// misma que usa la clasificación de un evento suelto) una vez hay algo que
// enseñar.

export interface ProgramScoresSegment {
  id: string;
  label: string;
  showLabel: boolean;
  locked: boolean;
  deadlineIso: string;
  hasScores: boolean;
  rosters: RosterScore[];
}

export interface ProgramScoresEvent {
  id: string;
  categoryLabel: string;
  isTest: boolean;
  segments: ProgramScoresSegment[];
}

export interface ProgramScoresColumn {
  key: string;
  label: string;
  events: ProgramScoresEvent[];
}

export default function ProgramScoresAccordion({
  columns,
  expandAllLabel,
  collapseAllLabel,
  emptySegmentText,
}: {
  columns: ProgramScoresColumn[];
  expandAllLabel: string;
  collapseAllLabel: string;
  emptySegmentText: (label: string) => string;
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
                  <span className="ml-1 font-normal normal-case text-slate-500">({col.events.length})</span>
                </span>
                <span
                  className={`text-sm text-slate-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {!isCollapsed && (
                <div className="space-y-6 px-4 pb-6">
                  {col.events.map((ev) => (
                    <div key={ev.id} className="space-y-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800/80 pb-1.5">
                        {ev.categoryLabel}
                        {ev.isTest && <span className="ml-1 text-amber-400">🧪</span>}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {ev.segments.map((seg) => (
                          <div key={seg.id} className="space-y-2">
                            {seg.showLabel && (
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {seg.label}
                              </p>
                            )}
                            {!seg.locked ? (
                              <LockedNotice label={seg.label} deadline={seg.deadlineIso} />
                            ) : seg.rosters.length === 0 ? (
                              <EmptyNotice text={emptySegmentText(seg.label)} />
                            ) : !seg.hasScores ? (
                              <PendingScoresNotice label={seg.label} />
                            ) : (
                              <PaginatedRosterList rosters={seg.rosters} />
                            )}
                          </div>
                        ))}
                      </div>
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
