import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLeagueLeaderboard } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import JoinLeagueForm from "../JoinLeagueForm";
import CopyCodeButton from "./CopyCodeButton";
import CopyLinkButton from "./CopyLinkButton";
import LeagueMembersManager from "./LeagueMembersManager";
import LeaveLeagueButton from "./LeaveLeagueButton";
import DeleteLeagueButton from "./DeleteLeagueButton";

export const dynamic = "force-dynamic";

// Mismo patrón que src/app/layout.tsx para construir URLs absolutas: el
// enlace de invitación tiene que funcionar tal cual se comparta (WhatsApp,
// email...), así que no puede ser una ruta relativa.
const BASE_URL = process.env.NEXTAUTH_URL || "https://rollartfantasy.com";

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.leagues.detail;
  const tf = dict.fantasyHub;
  const genderLabel = dict.common.gender;

  const league = await prisma.league.findUnique({
    where: { id: params.id },
    include: {
      memberships: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } },
      events: {
        include: {
          event: { include: { discipline: true, category: true, competition: true } },
        },
      },
    },
  });

  if (!league) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 mt-4">
            {t.notFound}
          </div>
        </div>
      </div>
    );
  }

  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
    : null;
  const isMember = !!currentUser && league.memberships.some((m) => m.userId === currentUser.id);

  if (!isMember) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
            <p className="text-sm text-slate-300">{t.notMember}</p>
            <p className="text-xs text-slate-500">{t.joinWithCode}</p>
            {currentUser && (
              <div className="max-w-xs mx-auto">
                <JoinLeagueForm />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const ranking = await computeLeagueLeaderboard(league.id);
  // currentUser no puede ser null aquí: isMember ya lo exige más arriba.
  const isOwner = currentUser!.id === league.ownerId;
  const viewerMembership = league.memberships.find((m) => m.userId === currentUser!.id);
  // El creador siempre puede gestionar (isOwner ya lo cubre); un admin
  // nombrado por el creador también puede echar miembros normales, aunque
  // no pueda nombrar a otros admins ni borrar la liga — ver
  // LeagueMembersManager y el PATCH de members/[userId].
  const viewerIsAdmin = isOwner || !!viewerMembership?.isAdmin;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h1 className="text-2xl font-extrabold tracking-tight">{league.name}</h1>
            </div>
            {/* Salir/borrar: reglas distintas según quién mira la página —
                ver el comentario en DELETE /api/leagues/[id]/members/[userId].
                Quien creó la liga no puede salir (se quedaría sin dueño),
                así que en su lugar ve el botón de borrarla entera. */}
            {isOwner ? (
              <DeleteLeagueButton leagueId={league.id} leagueName={league.name} />
            ) : (
              <LeaveLeagueButton leagueId={league.id} userId={currentUser!.id} />
            )}
          </div>
          {isOwner && <p className="text-xs text-slate-500 mt-2">{t.ownerCannotLeaveHint}</p>}
        </div>

        {/* Invitación: código para teclear a mano, o enlace directo que une
            automáticamente al abrirlo (ver /fantasy/leagues/join/[code]) —
            dos formas de compartir lo mismo, según lo que le venga mejor a
            quien invitas. */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.codeLabel}</p>
              <p className="text-xl font-mono font-bold tracking-widest text-indigo-300 mt-1">{league.code}</p>
              <p className="text-xs text-slate-500 mt-1">{t.codeHint}</p>
            </div>
            <CopyCodeButton code={league.code} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.inviteLinkLabel}</p>
              <p className="text-sm font-mono text-slate-300 mt-1 truncate">{`${BASE_URL}/fantasy/leagues/join/${league.code}`}</p>
              <p className="text-xs text-slate-500 mt-1">{t.inviteLinkHint}</p>
            </div>
            <CopyLinkButton url={`${BASE_URL}/fantasy/leagues/join/${league.code}`} />
          </div>
        </div>

        {/* Miembros — el creador puede echar a cualquiera que no sea él
            mismo, nombrar/quitar administradores, y un administrador puede
            echar a los miembros normales (ver LeagueMembersManager). */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.membersTitle}</h2>
          </div>
          <LeagueMembersManager
            leagueId={league.id}
            ownerId={league.ownerId}
            isOwner={isOwner}
            viewerIsAdmin={viewerIsAdmin}
            members={league.memberships.map((m) => ({
              id: m.id,
              userId: m.userId,
              name: m.user.name,
              isAdmin: m.isAdmin,
            }))}
          />
        </div>

        {/* Eventos de la liga */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.eventsTitle}</h2>
          </div>
          <div className="divide-y divide-slate-800/80">
            {league.events.map((le) => (
              <Link
                key={le.id}
                href={`/events/${le.event.id}`}
                className="block p-4 hover:bg-slate-800/30 transition"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {translateDisciplineName(le.event.discipline.name, locale)} ·{" "}
                  {translateCategoryName(le.event.category.name, locale)}
                  {le.event.gender ? ` · ${genderLabel[le.event.gender as keyof typeof genderLabel] ?? le.event.gender}` : ""}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {le.event.competition.name} — {le.event.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Ranking */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.rankingTitle}</h2>
          </div>
          {ranking.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">{t.noRanking}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                    <th className="py-3 px-4 w-16">{tf.rank}</th>
                    <th className="py-3 px-4">{tf.coach}</th>
                    <th className="py-3 px-4 text-center">{tf.events}</th>
                    <th className="py-3 px-4 text-right font-bold text-white">{tf.points}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {ranking.map((row, index) => (
                    <tr key={row.userId} className="hover:bg-slate-800/30 transition font-mono">
                      <td className="py-3 px-4 font-bold text-slate-400">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">{row.userName}</td>
                      <td className="py-3 px-4 text-center text-slate-400 font-sans text-xs">
                        {row.eventsPlayed}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-400">
                        {row.total.toFixed(2)} {tf.pointsSuffix}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
