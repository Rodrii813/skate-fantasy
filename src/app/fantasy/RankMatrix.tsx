"use client";

import { useState } from "react";

// "Overall Total / Global Standings" del Fantasy Hub: selector de modalidad
// (disciplina+género) en pestañas deslizables — igual que DraftStatusAccordion
// — y, para la modalidad activa, una tabla de 2 filas (Corto arriba, Largo
// abajo) con una columna por cada categoría de esa modalidad, todo en el
// mismo cuadro. Antes era una tira horizontal con TODAS las modalidades
// mezcladas a la vez, que perdía la noción de fila Corto/Largo; ahora cada
// modalidad se mira por separado, como pidió el usuario.

export interface RankMatrixCell {
  segmentId: string;
  segmentLabel: string;
  total: number | null; // null = no has drafteado o todavía no hay puntuación
  rank: number | null; // null = no hay nada que rankear todavía
}

export interface RankMatrixEvent {
  id: string;
  categoryLabel: string;
  isTest: boolean;
  cells: RankMatrixCell[];
}

export interface RankMatrixGroup {
  key: string;
  label: string;
  events: RankMatrixEvent[];
}

export default function RankMatrix({
  groups,
  rankPrefix,
}: {
  groups: RankMatrixGroup[];
  // Prefijo delante del puesto, p.ej. "#" → "#108".
  rankPrefix: string;
}) {
  const [activeKey, setActiveKey] = useState<string>(groups[0]?.key ?? "");
  const activeGroup = groups.find((g) => g.key === activeKey) ?? groups[0];
  const maxRows = Math.max(1, ...(activeGroup?.events.map((ev) => ev.cells.length) ?? [1]));

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto p-3 border-b border-slate-800">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActiveKey(g.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
              g.key === activeGroup?.key
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {activeGroup && (
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="w-16" />
                {activeGroup.events.map((ev) => (
                  <th
                    key={ev.id}
                    className="px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 truncate max-w-[9rem]"
                  >
                    {ev.categoryLabel}
                    {ev.isTest && <span className="ml-1 text-amber-400">🧪</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="pr-2 py-1 text-[10px] text-slate-500 whitespace-nowrap">
                    {activeGroup.events[0]?.cells[rowIndex]?.segmentLabel ?? ""}
                  </td>
                  {activeGroup.events.map((ev) => {
                    const cell = ev.cells[rowIndex];
                    if (!cell) return <td key={ev.id} className="px-1 py-1" />;
                    return (
                      <td key={ev.id} className="px-1 py-1 min-w-[6.5rem]">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-center">
                          <p className="text-xs font-bold text-slate-100">
                            {cell.total !== null ? cell.total.toFixed(2) : "—"}
                          </p>
                          {cell.rank !== null && (
                            <p className="text-[10px] font-semibold text-indigo-400">
                              {rankPrefix}
                              {cell.rank}
                            </p>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
