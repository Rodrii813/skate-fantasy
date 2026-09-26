import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import CreateLeagueForm from "./CreateLeagueForm";

export const dynamic = "force-dynamic";

export default async function NewLeaguePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.leagues.new;
  const genderLabel = dict.common.gender;

  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        orderBy: [{ discipline: { name: "asc" } }, { category: { order: "asc" } }],
        include: { discipline: true, category: true },
      },
    },
  });

  const competitionGroups = competitions
    .filter((c) => c.events.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      events: c.events.map((e) => ({
        id: e.id,
        label: `${e.discipline.name} · ${e.category.name}${
          e.gender ? ` · ${genderLabel[e.gender as keyof typeof genderLabel] ?? e.gender}` : ""
        } — ${e.name}`,
      })),
    }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-2">{t.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
        </div>

        <CreateLeagueForm competitions={competitionGroups} />
      </div>
    </div>
  );
}
