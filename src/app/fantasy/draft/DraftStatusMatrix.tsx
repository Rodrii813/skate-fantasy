"use client";

import Link from "next/link";
import { useState } from "react";

// Selector del Draft Room: una matriz compacta (filas = Corto/Largo,
// columnas = cada prueba/categoría de esa disciplina+género) de celdas de
// color, igual que la referencia (RockerLive) — pero agrupada por disciplina
// en bloques separados y PLEGABLES (empiezan plegados, como el acordeón del
// Fantasy Hub) porque aquí hay muchas más categorías por disciplina que las
// 4 columnas fijas de la referencia. Las celdas se aprietan al mínimo posible
// en ancho (sobre todo "Próximamente", la más larga) para que quepan más
// columnas sin desbordar.
//
// A diferencia del acordeón de tarjetas del Fantasy Hub (DraftStatusAccordion,
// que enseña tu equipo ya elegido), esta matriz solo enseña el ESTADO de cada
// prueba+segmento y sirve de navegador: al pulsar una celda se carga el
// formulario de draftear de esa prueba+segmento debajo, en esta misma página
// (ver draft/page.tsx). La celda de la prueba+segmento actualmente cargada
// (si hay una) se resalta con un anillo, y su disciplina empieza ya
// desplegada para que se vea sin tener que buscarla.

export interface DraftMatrixCell {
  segmentId: string;
  segmentLabel: string;
  state: "proximamente" | "abierto" | "cerrado";
  drafted: boolean;
  href: string | null;
}

export interface DraftMatrixEvent {
  id: string;
  categoryLabel: string;
  isTest: boolean;
  cells: DraftMatrixCell[];
}

export interface DraftMatrixGroup {
  key: string;
  label: string;
  events: DraftMatrixEvent[];
}

export interface DraftMatrixLabels {
  upcoming: string;
  openUndrafted: string;
  openDrafted: string;
  closedDrafted: string;
  closedUndrafted: string;
}

function cellStyle(cell: DraftMatrixCell, labels: DraftMatrixLabels) {
  if (cell.state === "proximamente") {
    return { label: labels.upcoming, className: "border-slate-800 bg-slate-900/60 text-slate-600" };
  }
  if (cell.state === "abierto") {
    return cell.drafted
      ? { label: labels.openDrafted, className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" }
      : { label: labels.openUndrafted, className: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
  }
  // cerrado
  return cell.drafted
    ? { label: labels.closedDrafted, className: "border-slate-700 bg-slate-800/60 text-slate-300" }
    : { label: labels.closedUndrafted, className: "border-slate-800 bg-slate-900/40 text-slate-500" };
}

export default function DraftStatusMatrix({
  groups,
  selectedSegmentId,
  labels,
}: {
  groups: DraftMatrixGroup[];
  selectedSegmentId?: string;
  labels: DraftMatrixLabels;
}) {
  // Empiezan todas plegadas, salvo la disciplina que contenga la celda
  // actualmente seleccionada (si hay una) — así no desaparece de la vista al
  // cargar el formulario de abajo.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const groupWithSelection = selectedSegmentId
      ? groups.find((g) => g.events.some((ev) => ev.cells.some((c) => c.segmentId === selectedSegmentId)))
      : null;
    return new Set(groups.filter((g) => g.key !== groupWithSelection?.key).map((g) => g.key));
  });

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="divide-y divide-slate-800">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const maxRows = Math.max(1, ...group.events.map((ev) => ev.cells.length));
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => toggle(group.key)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-slate-800/30"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {group.label}{" "}
                <span className="ml-1 font-normal normal-case text-slate-500">({group.events.length})</span>
              </span>
              <span
                className={`text-sm text-slate-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto px-4 pb-3">
                <table className="text-left text-xs">
                  <thead>
                    <tr>
                      <th className="w-12" />
                      {group.events.map((ev) => (
                        <th
                          key={ev.id}
                          className="px-1 pb-1 align-bottom text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-500 whitespace-normal break-words min-w-[6.5rem] max-w-[8.5rem]"
                        >
                          {ev.categoryLabel}
                          {ev.isTest && <span className="ml-0.5 text-amber-400">🧪</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxRows }).map((_, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="pr-2 py-1 text-[10px] text-slate-500 whitespace-nowrap">
                          {group.events[0]?.cells[rowIndex]?.segmentLabel ?? ""}
                        </td>
                        {group.events.map((ev) => {
                          const cell = ev.cells[rowIndex];
                          if (!cell) return <td key={ev.id} className="px-1 py-1" />;
                          const style = cellStyle(cell, labels);
                          const isSelected = cell.segmentId === selectedSegmentId;
                          const pill = (
                            <span
                              className={`block rounded-md border px-2 py-1.5 text-center text-[10px] font-semibold leading-tight transition ${style.className} ${
                                isSelected ? "ring-2 ring-indigo-400" : ""
                              } ${cell.href ? "cursor-pointer hover:brightness-110" : ""}`}
                            >
                              {style.label}
                            </span>
                          );
                          return (
                            <td key={ev.id} className="px-1 py-1 min-w-[6.5rem] max-w-[8.5rem]">
                              {cell.href ? <Link href={cell.href}>{pill}</Link> : pill}
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
      })}
    </div>
  );
}
