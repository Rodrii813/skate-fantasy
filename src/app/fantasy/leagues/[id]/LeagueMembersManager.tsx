"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// Lista de miembros de una liga privada, con botón de "Echar" cuando quien
// mira la página puede gestionarla (el creador siempre, o un administrador
// que el creador haya nombrado — ver isAdmin en el esquema y el PATCH de
// members/[userId]). Un administrador solo puede echar a miembros normales:
// ni al creador ni a otro administrador. Nombrar/quitar administradores
// (el botón "Hacer admin"/"Quitar admin") sigue siendo solo del creador.
// Salir de la liga voluntariamente es un botón aparte (LeaveLeagueButton),
// porque tiene reglas distintas (el creador no puede).
export default function LeagueMembersManager({
  leagueId,
  ownerId,
  isOwner,
  viewerIsAdmin,
  members,
}: {
  leagueId: string;
  ownerId: string;
  isOwner: boolean;
  viewerIsAdmin: boolean;
  members: { id: string; userId: string; name: string | null; isAdmin: boolean }[];
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.detail;
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [changingAdminId, setChangingAdminId] = useState<string | null>(null);
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

  const handleToggleAdmin = async (member: { userId: string; name: string | null; isAdmin: boolean }) => {
    const nextIsAdmin = !member.isAdmin;
    const confirmMsg = nextIsAdmin ? t.promoteConfirm(member.name || "") : t.demoteConfirm(member.name || "");
    if (!window.confirm(confirmMsg)) return;
    setChangingAdminId(member.userId);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: nextIsAdmin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.adminChangeError);
      router.refresh();
    } catch (err: any) {
      setError(err.message || t.adminChangeError);
    } finally {
      setChangingAdminId(null);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const isTargetOwner = m.userId === ownerId;
          // Un admin (no dueño) solo puede echar a miembros normales; el
          // dueño puede echar a cualquiera que no sea él mismo.
          const canKick = !isTargetOwner && (isOwner || (viewerIsAdmin && !m.isAdmin));
          return (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-slate-200 pl-3 pr-1.5 py-1.5 rounded-full font-medium"
            >
              {m.name}
              {isTargetOwner && <span className="text-amber-400 font-semibold">★</span>}
              {!isTargetOwner && m.isAdmin && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-300 bg-indigo-950/70 px-1.5 py-0.5 rounded-full border border-indigo-800/60">
                  {t.adminBadge}
                </span>
              )}
              {/* Nombrar/quitar admin: solo el creador, y nunca sobre sí mismo. */}
              {isOwner && !isTargetOwner && (
                <button
                  type="button"
                  onClick={() => handleToggleAdmin(m)}
                  disabled={changingAdminId === m.userId}
                  title={m.isAdmin ? t.removeAdminBtn : t.makeAdminBtn}
                  className="ml-1 rounded-full bg-slate-700 hover:bg-indigo-700 disabled:opacity-50 text-slate-300 hover:text-white px-2 h-5 inline-flex items-center justify-center text-[10px] font-semibold leading-none transition"
                >
                  {changingAdminId === m.userId ? t.changingAdmin : m.isAdmin ? t.removeAdminBtn : t.makeAdminBtn}
                </button>
              )}
              {canKick && (
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
          );
        })}
      </div>
      {isOwner && <p className="text-[11px] text-slate-500">{t.adminHint}</p>}
    </div>
  );
}
