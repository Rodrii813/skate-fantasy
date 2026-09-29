import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

// Enlace directo de invitación a una liga privada: /fantasy/leagues/join/CODIGO
// Es la alternativa a teclear el código a mano en /fantasy/leagues — mismo
// código de 6 caracteres, solo que aquí basta con abrir el enlace. Si ya has
// iniciado sesión te une automáticamente y te lleva a la liga; si no, te
// manda primero a iniciar sesión y, gracias a ?callbackUrl=, vuelve aquí
// después para terminar de unirte sin que tengas que volver a pegar el
// enlace o teclear el código.
export default async function JoinLeagueByLinkPage({ params }: { params: { code: string } }) {
  const locale = getLocale();
  const t = getDictionary(locale).leagues;
  const normalizedCode = params.code.trim().toUpperCase();

  const league = await prisma.league.findUnique({ where: { code: normalizedCode } });

  if (!league) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-md mx-auto">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
            <p className="text-sm text-slate-300">{t.detail.notFound}</p>
            <Link
              href="/fantasy/leagues"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              {t.back}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const session = await getServerSession(authOptions);
  const callbackUrl = `/fantasy/leagues/join/${normalizedCode}`;
  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // Idéntico a POST /api/leagues/join: idempotente, así que abrir el mismo
  // enlace varias veces (o ya ser miembro) no da ningún error, solo confirma.
  await prisma.leagueMembership.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
    update: {},
    create: { leagueId: league.id, userId: user.id },
  });

  redirect(`/fantasy/leagues/${league.id}`);
}
