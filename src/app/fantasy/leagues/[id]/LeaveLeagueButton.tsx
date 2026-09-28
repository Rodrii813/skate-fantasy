"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// Botón para que un miembro (que NO sea el creador) abandone una liga
// privada por su cuenta. El creador no ve este botón — ver
// ownerCannotLeaveHint en su lugar (ver [id]/page.tsx).
export default function LeaveLeagueButton({ leagueId, userId }: { leagueId: string; userId: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.detail;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    if (!window.confirm(t.leaveConfirm)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/members/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.leaveError);
      router.push("/fantasy/leagues");
      router.refresh();
    } catch (err: any) {
      setError(err.message || t.leaveError);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleLeave}
        disabled={loading}
        className="text-xs bg-slate-800 hover:bg-red-900/60 disabled:opacity-50 text-slate-300 hover:text-red-200 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-800 transition"
      >
        {loading ? t.leaving : t.leaveBtn}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
