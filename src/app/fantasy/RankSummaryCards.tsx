import Link from "next/link";
import type { MyLeagueRank } from "./rankSummary";

// Tarjetas de resumen (Global + una por cada Liga Privada a la que
// pertenezcas) que aparecen tanto en el Fantasy Hub como en la nueva página
// de Leaderboard — mismo componente en los dos sitios para que el "Nº de Nº"
// se vea y se calcule siempre igual. Si no perteneces a ninguna liga, se
// muestra una única tarjeta invitando a unirte/crear una (ver `joinHref`).
export default function RankSummaryCards({
  globalLabel,
  globalRank,
  globalTotal,
  globalHref,
  leagues,
  joinLabel,
  joinHref,
  ofWord,
  noRankLabel,
}: {
  globalLabel: string;
  globalRank: number | null;
  globalTotal: number;
  globalHref: string;
  leagues: MyLeagueRank[];
  joinLabel: string;
  joinHref: string;
  ofWord: string;
  noRankLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Link
        href={globalHref}
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center transition hover:border-indigo-500/60 hover:bg-slate-900"
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{globalLabel}</p>
        {globalRank ? (
          <>
            <p className="mt-2 text-xl font-black text-white">{globalRank}</p>
            <p className="text-[11px] text-slate-500">
              {ofWord} {globalTotal}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{noRankLabel}</p>
        )}
      </Link>

      {leagues.length === 0 ? (
        <Link
          href={joinHref}
          className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center transition hover:border-indigo-500/60 hover:bg-slate-900/80 flex flex-col items-center justify-center"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{joinLabel}</p>
        </Link>
      ) : (
        leagues.map((league) => (
          <Link
            key={league.id}
            href={`/fantasy/leagues/${league.id}`}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center transition hover:border-indigo-500/60 hover:bg-slate-900"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
              {league.name}
            </p>
            {league.rank ? (
              <>
                <p className="mt-2 text-xl font-black text-white">{league.rank}</p>
                <p className="text-[11px] text-slate-500">
                  {ofWord} {league.total}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">{noRankLabel}</p>
            )}
          </Link>
        ))
      )}
    </div>
  );
}
