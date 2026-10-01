"use client";

import { useState } from "react";
import type { RosterScore } from "@/lib/scoring";

const medal = ["🥇", "🥈", "🥉"];
const PAGE_SIZE = 15;

// Mismo componente de roster plegable que antes (RosterCard en page.tsx),
// movido aquí para poder paginar: con muchos rosters la lista se hacía
// interminable — igual motivo que el acordeón de Draft Status y la
// paginación del ranking del hub de /fantasy. Solo las 3 primeras posiciones
// GLOBALES (no por página) empiezan desplegadas.
function RosterCard({ roster, index }: { roster: RosterScore; index: number }) {
  return (
    <details
      key={roster.rosterId}
      className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
      open={index < 3}
    >
      <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg font-black text-slate-400 w-10 shrink-0 text-center">
            {medal[index] || `#${index + 1}`}
          </span>
          <span className="font-semibold text-slate-100 truncate">{roster.userName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono font-bold text-indigo-400 text-lg">{roster.total.toFixed(2)} pts</span>
          <span className="text-slate-500 text-xs transition group-open:rotate-90">▶</span>
        </div>
      </summary>

      <div className="border-t border-slate-800 divide-y divide-slate-800/80">
        {roster.slots.map((slot) => (
          <div key={slot.slotId} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="text-slate-400">{slot.slotLabel}</p>
              <p className="text-slate-200 font-semibold truncate">{slot.skaterName}</p>
            </div>
            <span className="font-mono font-bold text-slate-300 shrink-0">{slot.points.toFixed(2)} pts</span>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function PaginatedRosterList({ rosters }: { rosters: RosterScore[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rosters.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageRosters = rosters.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-3">
      {pageRosters.map((roster, i) => (
        <RosterCard key={roster.rosterId} roster={roster} index={start + i} />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-xs">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:text-slate-300"
          >
            ← Anterior
          </button>
          <span className="text-slate-400">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:text-slate-300"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
