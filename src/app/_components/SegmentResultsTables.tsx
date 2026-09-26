import type { SegmentResultBlock } from "@/lib/segmentResults";

// 3 bloques colapsables por evento — "Programa Corto" / "Programa Largo" /
// "Total" — inspirado en el patrón de rockerskating.com ("Short Program
// Final" / "Free Skate Final" / "Total Score"). Server component puro (sin
// "use client"): usa <details>/<summary> nativos para el colapsado, sin
// necesitar JS en el cliente.

const numberOrDash = (n: number | null) => (n !== null && n !== undefined ? n.toFixed(2) : "—");

export default function SegmentResultsTables({
  blocks,
  defaultOpen = true,
  gender = null,
}: {
  blocks: SegmentResultBlock[];
  defaultOpen?: boolean;
  // Género del EVENTO (no de cada patinador/a individual): "FEMALE" rotula
  // como "Patinadora(s)", cualquier otro valor (MALE o mixto/null) como
  // "Patinador(es)" — igual que en la pestaña de Orden de Salida.
  gender?: "MALE" | "FEMALE" | null;
}) {
  const isFemale = gender === "FEMALE";
  const skaterWord = isFemale ? "Patinadora" : "Patinador";
  const skaterWordPlural = isFemale ? "patinadoras" : "patinadores";

  return (
    <div className="divide-y divide-slate-800">
      {blocks.map((block) => (
        <details key={block.key} open={defaultOpen} className="group">
          <summary className="cursor-pointer list-none p-5 flex items-center justify-between hover:bg-slate-800/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs transition group-open:rotate-90">▶</span>
              <h3 className="text-sm font-bold text-slate-100">{block.title}</h3>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
              {block.rows.length} {block.rows.length === 1 ? skaterWord.toLowerCase() : skaterWordPlural}
            </span>
          </summary>

          {block.rows.length === 0 ? (
            <div className="px-5 pb-5 text-xs text-slate-500">
              Todavía sin puntuaciones oficiales cargadas para {block.title}.
            </div>
          ) : block.key === "total" ? (
            // El bloque Total no repite el desglose técnico (TES/PCS/
            // Deducciones ya se ven en los bloques de Corto y Largo de
            // arriba): aquí se muestra el puesto y los puntos que sacó cada
            // patinadora en cada segmento por separado, más la suma final.
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-300 font-semibold border-y border-slate-700/80 text-xs uppercase tracking-wider">
                    <th className="py-2.5 px-5 w-16">Puesto</th>
                    <th className="py-2.5 px-4">{skaterWord}</th>
                    <th className="py-2.5 px-4 text-right">Corto</th>
                    <th className="py-2.5 px-4 text-right">Largo</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {block.rows.map((row) => (
                    <tr key={row.registrationId} className="hover:bg-slate-800/30 transition font-mono">
                      <td className="py-3 px-5 font-bold text-slate-400">
                        {row.rank !== null ? `#${row.rank}` : "—"}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                        {row.skaterName}{" "}
                        {row.country && (
                          <span className="font-mono text-[11px] text-slate-500">({row.country})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {row.shortScore !== null && row.shortScore !== undefined ? (
                          <>
                            <span className="text-slate-500 text-xs">
                              {row.shortRank ? `#${row.shortRank} · ` : ""}
                            </span>
                            {row.shortScore.toFixed(2)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {row.longScore !== null && row.longScore !== undefined ? (
                          <>
                            <span className="text-slate-500 text-xs">
                              {row.longRank ? `#${row.longRank} · ` : ""}
                            </span>
                            {row.longScore.toFixed(2)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-400 text-base">
                        {numberOrDash(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-300 font-semibold border-y border-slate-700/80 text-xs uppercase tracking-wider">
                    <th className="py-2.5 px-5 w-16">Puesto</th>
                    <th className="py-2.5 px-4">{skaterWord}</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4 text-right">TES</th>
                    <th className="py-2.5 px-4 text-right">PCS</th>
                    <th className="py-2.5 px-4 text-right">Deducciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {block.rows.map((row) => (
                    <tr key={row.registrationId} className="hover:bg-slate-800/30 transition font-mono">
                      <td className="py-3 px-5 font-bold text-slate-400">
                        {row.rank !== null ? `#${row.rank}` : "—"}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                        {row.skaterName}{" "}
                        {/* Los emojis de bandera no se renderizan bien en
                            todos los sistemas (en Windows, sobre todo, salen
                            en blanco o como texto suelto que parecía un país
                            duplicado). Se muestra solo el código de país. */}
                        {row.country && (
                          <span className="font-mono text-[11px] text-slate-500">({row.country})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-400 text-base">
                        {numberOrDash(row.total)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{numberOrDash(row.tes)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{numberOrDash(row.pcs)}</td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {/* row.deductions ya viene con su signo real desde el
                            acta oficial (0 o negativo, p.ej. -1.00): antes se
                            le anteponía otro "-" a mano, así que un valor ya
                            negativo salía con doble guion ("--1.00"). */}
                        {row.deductions.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
