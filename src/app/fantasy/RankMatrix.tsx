// "Overall Total / Global Standings" del Fantasy Hub: tu puntuación total y
// tu puesto en CADA segmento. Una única tira horizontal deslizable (como en
// la referencia, que tenía las 4 disciplinas en una sola fila) en vez de un
// bloque por disciplina apilado verticalmente — con muchas más categorías
// que la referencia, apilar un bloque por disciplina ocupaba muchísima
// altura de página. Cada tarjeta lleva su disciplina+categoría+segmento
// encima para no perder el contexto al no haber ya una tabla por disciplina.
// Sin interactividad (no hace falta cliente): solo informa, no navega a
// ningún sitio.

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
    <div className="overflow-x-auto">
      <div className="flex gap-2 p-4 w-max">
        {groups.map((group) =>
          group.events.map((ev) =>
            ev.cells.map((cell) => (
              <div
                key={cell.segmentId}
                className="w-28 shrink-0 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-center"
              >
                <p className="truncate text-[9px] uppercase tracking-wide text-slate-500">{group.label}</p>
                <p className="truncate text-[9px] text-slate-600">
                  {ev.categoryLabel}
                  {ev.isTest && <span className="ml-0.5 text-amber-400">🧪</span>} · {cell.segmentLabel}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-100">
                  {cell.total !== null ? cell.total.toFixed(2) : "—"}
                </p>
                {cell.rank !== null && (
                  <p className="text-[10px] font-semibold text-indigo-400">
                    {rankPrefix}
                    {cell.rank}
                  </p>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
