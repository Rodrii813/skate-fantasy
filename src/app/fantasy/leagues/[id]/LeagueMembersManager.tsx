"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// Lista de miembros de una liga privada, con botón de "Echar" cuando quien
// mira la página es el creador de la liga — para el resto de miembros (y
// para el propio creador sobre sí mismo) no aparece ningún botón, solo el
// nombre. Salir de la liga voluntariamente es un botón aparte
// (LeaveLeagueButton), porque tiene reglas distintas (el creador no puede).
export default function LeagueMembersManager({
  leagueId,
  ownerId,
  isOwner,
  members,
}: {
  leagueId: string;
  ownerId: string;
  isOwner: boolean;
  members: { id: string; userId: string; name: string | null }[];
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.detail;
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleKick = async (member: { userId: string; name: string | null }) => {
    if (!window.confirm(t.kickConfirm(member.name || ""))) return;
    setKickingId(member.userId);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/members/${member.userId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.kickError);
      router.refresh();
    } catch (err: any) {
      setError(err.message || t.kickError);
    } finally {
      setKickingId(null);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-slate-200 pl-3 pr-1.5 py-1.5 rounded-full font-medium"
          >
            {m.name}
            {m.userId === ownerId && <span className="text-amber-400 font-semibold">★</span>}
            {isOwner && m.userId !== ownerId && (
              <button
                type="button"
                onClick={() => handleKick(m)}
                disabled={kickingId === m.userId}
                title={t.kickBtn}
                className="ml-1 rounded-full bg-slate-700 hover:bg-red-700 disabled:opacity-50 text-slate-300 hover:text-white w-5 h-5 inline-flex items-center justify-center text-[11px] leading-none transition"
              >
                {kickingId === m.userId ? "…" : "✕"}
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
