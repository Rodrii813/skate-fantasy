import Link from "next/link";

// Selector del Draft Room: una matriz compacta (filas = Corto/Largo,
// columnas = cada prueba/categoría de esa disciplina+género) de celdas de
// color, igual que la referencia (RockerLive) — pero agrupada por disciplina
// en bloques separados (cada bloque es su propia tabla) porque aquí hay
// muchas más categorías por disciplina que las 4 columnas fijas de la
// referencia; así cada tabla se queda del mismo tamaño que tendría la
// referencia (unas pocas columnas) en vez de una única tabla gigante.
//
// A diferencia del acordeón de tarjetas del Fantasy Hub (DraftStatusAccordion,
// que enseña tu equipo ya elegido), esta matriz solo enseña el ESTADO de cada
// prueba+segmento y sirve de navegador: al pulsar una celda se carga el
// formulario de draftear de esa prueba+segmento debajo, en esta misma página
// (ver draft/page.tsx). La celda de la prueba+segmento actualmente cargada
// (si hay una) se resalta con un anillo.

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
  return (
    <div className="divide-y divide-slate-800">
      {groups.map((group) => {
        const maxRows = Math.max(1, ...group.events.map((ev) => ev.cells.length));
        return (
          <div key={group.key} className="p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">{group.label}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="w-16" />
                    {group.events.map((ev) => (
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
                        {group.events[0]?.cells[rowIndex]?.segmentLabel ?? ""}
                      </td>
                      {group.events.map((ev) => {
                        const cell = ev.cells[rowIndex];
                        if (!cell) return <td key={ev.id} className="px-1 py-1" />;
                        const style = cellStyle(cell, labels);
                        const isSelected = cell.segmentId === selectedSegmentId;
                        const pill = (
                          <span
                            className={`block rounded-lg border px-2 py-1.5 text-center text-[10px] font-semibold leading-tight transition ${style.className} ${
                              isSelected ? "ring-2 ring-indigo-400" : ""
                            } ${cell.href ? "cursor-pointer hover:brightness-110" : ""}`}
                          >
                            {style.label}
                          </span>
                        );
                        return (
                          <td key={ev.id} className="px-1 py-1 min-w-[6.5rem]">
                            {cell.href ? <Link href={cell.href}>{pill}</Link> : pill}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
