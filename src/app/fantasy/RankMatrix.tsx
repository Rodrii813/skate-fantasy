// "Overall Total / Global Standings" del Fantasy Hub — calcada de la
// referencia: una matriz compacta con tu puntuación total y tu puesto en
// CADA segmento, filas Corto/Largo y columnas por disciplina+género. Igual
// que DraftStatusMatrix (el selector del Draft Room), agrupada por disciplina
// en bloques separados porque aquí hay muchas más categorías por disciplina
// que las 4 columnas fijas de la referencia. Sin interactividad (no hace
// falta cliente): solo informa, no navega a ningún sitio.

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
          </div>
        );
      })}
    </div>
  );
}
