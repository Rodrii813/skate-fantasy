"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// Borra la liga entera (para todos los miembros) — solo el creador ve este
// botón (ver [id]/page.tsx). Mismo patrón de "escribe el nombre exacto para
// confirmar" que el borrado de eventos en /admin/events, porque es igual de
// irreversible: se lleva por delante el ranking y la pertenencia de todos.
export default function DeleteLeagueButton({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.detail;
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText !== leagueName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.deleteLeagueError);
      router.push("/fantasy/leagues");
      router.refresh();
    } catch (err: any) {
      setError(err.message || t.deleteLeagueError);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-800 transition"
      >
        {t.deleteLeagueBtn}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-red-900 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">{t.deleteLeagueTitle}</h3>
            <p className="text-xs text-slate-300">{t.deleteLeagueWarning(leagueName)}</p>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold text-xs">{t.deleteLeagueTypeLabel}</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={leagueName}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-xs"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                {t.deleteLeagueCancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== leagueName || loading}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                {loading ? t.deletingLeague : t.deleteLeagueSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
