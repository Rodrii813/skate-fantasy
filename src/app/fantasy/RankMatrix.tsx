// "Overall Total / Global Standings" del Fantasy Hub: tu puntuación total y
// tu puesto en CADA segmento. En horizontal (pruebas en filas, Corto/Largo
// en columnas lado a lado) en vez de apilar cada segmento como una fila
// propia — con muchas categorías por disciplina, apilarlas en vertical
// ocupaba muchísima altura de página. Agrupada por disciplina en bloques
// separados (cada bloque es su propia tabla pequeña), igual que
// DraftStatusMatrix del Draft Room. Sin interactividad (no hace falta
// cliente): solo informa, no navega a ningún sitio.

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
        // Etiquetas de columna (Corto/Largo): se toman del primer evento del
        // grupo que tenga celdas — todos los eventos de un mismo grupo
        // comparten el mismo orden de segmentos (ver fantasy/page.tsx).
        const segmentLabels = group.events.find((ev) => ev.cells.length > 0)?.cells.map((c) => c.segmentLabel) ?? [];
        return (
          <div key={group.key} className="p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">{group.label}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="pb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {/* columna de la prueba/categoría, sin cabecera propia */}
                    </th>
                    {segmentLabels.map((label, i) => (
                      <th
                        key={i}
                        className="px-1 pb-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-1 pr-2 text-[10px] text-slate-400 whitespace-nowrap">
                        {ev.categoryLabel}
                        {ev.isTest && <span className="ml-1 text-amber-400">🧪</span>}
                      </td>
                      {ev.cells.map((cell) => (
                        <td key={cell.segmentId} className="px-1 py-1 min-w-[6.5rem]">
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
                      ))}
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
