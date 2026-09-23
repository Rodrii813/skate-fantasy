import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") redirect("/");

  const events = await prisma.event.findMany({
    orderBy: { rosterLocksAt: "desc" },
    include: { competition: true, discipline: true, category: true, registrations: true },
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-white">Panel de admin</h1>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-ice-100/70">
        Para dar de alta competiciones, disciplinas, categorías, patinadores, eventos, segmentos
        y slots de fantasy, usa <code className="text-accent">npm run db:studio</code> (Prisma
        Studio): te da un editor de tablas al instante sin tener que construir un CRUD para cada
        cosa. Esta pantalla se centra en lo que se hace cada semana: cargar resultados tras la
        competición.
      </div>

      <h2 className="font-display mt-10 text-xl font-semibold text-white">Cargar resultados por evento</h2>
      <ul className="mt-4 divide-y divide-white/10">
        {events.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-white">{e.name}</p>
              <p className="text-xs text-ice-100/50">
                {e.competition.name} · {e.registrations.length} patinadores inscritos
              </p>
            </div>
            <Link
              href={`/admin/results/${e.id}`}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white hover:border-gold/60"
            >
              Cargar puntuaciones
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
