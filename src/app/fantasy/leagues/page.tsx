import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import JoinLeagueForm from "./JoinLeagueForm";

export const dynamic = "force-dynamic";

export default async function LeaguesHubPage() {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const t = getDictionary(locale).leagues;

  const user = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
    : null;

  const myLeagues = user
    ? await prisma.league.findMany({
        where: { memberships: { some: { userId: user.id } } },
        include: {
          _count: { select: { memberships: true, events: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <Link href="/fantasy" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl">🏆</span>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
        </div>

        {!user ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm text-slate-300">{t.loginRequired}</p>
            <Link
              href="/login"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              {t.loginCta}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/fantasy/leagues/new"
                className="flex-1 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-3 rounded-xl transition shadow-lg shadow-indigo-900/30"
              >
                {t.createBtn}
              </Link>
              <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-400 mb-2">{t.joinTitle}</p>
                <JoinLeagueForm />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
              <div className="p-4 border-b border-slate-800">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  {t.myLeaguesTitle}
                </h2>
              </div>
              {myLeagues.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">{t.noLeagues}</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {myLeagues.map((league) => (
                    <Link
                      key={league.id}
                      href={`/fantasy/leagues/${league.id}`}
                      className="flex items-center justify-between gap-3 p-4 hover:bg-slate-800/30 transition"
                    >
                      <div>
                        <p className="font-semibold text-slate-100 text-sm">{league.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.membersCount(league._count.memberships)} · {t.eventsCount(league._count.events)}
                          {league.ownerId === user.id && (
                            <span className="ml-2 text-amber-400 font-semibold">{t.ownerTag}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-indigo-400 text-xs font-semibold whitespace-nowrap">
                        {t.openLeague}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
