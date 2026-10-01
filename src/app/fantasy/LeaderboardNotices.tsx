import LocalDateTime from "@/app/_components/LocalDateTime";

// Compartido entre la clasificación en vivo de UN evento
// (fantasy/[eventId]/leaderboard) y la nueva clasificación general de TODA
// la competición (fantasy/leaderboard) — antes estas tres estaban duplicadas
// solo en la primera, ahora las usan las dos.

export function LockedNotice({ label, deadline }: { label: string; deadline: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
      <p className="text-sm text-slate-300 font-semibold">
        La clasificación de {label} se publica cuando cierre su plazo de fichajes.
      </p>
      <p className="text-xs text-slate-500">
        Hasta entonces los rosters de otros jugadores se mantienen en secreto, para que nadie copie
        estrategia. Cierre: <LocalDateTime value={deadline} options={{ dateStyle: "medium", timeStyle: "short" }} />
      </p>
    </div>
  );
}

export function EmptyNotice({ text }: { text: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

export function PendingScoresNotice({ label }: { label: string }) {
  return (
    <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-6 text-center">
      <p className="text-xs text-amber-300 font-semibold">
        🔜 El plazo de {label} ya ha cerrado, pero el admin todavía no ha cargado las puntuaciones oficiales.
        Vuelve en un rato.
      </p>
    </div>
  );
}
