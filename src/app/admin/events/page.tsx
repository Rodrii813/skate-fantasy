import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EventsManager from "./EventsManager";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (user?.role !== "ADMIN") redirect("/");

  // Datos para los selectores al crear un evento
  const [competitions, disciplines, categories, events] = await Promise.all([
    prisma.competition.findMany({ orderBy: { startDate: "desc" } }),
    prisma.discipline.findMany(),
    prisma.category.findMany(),
    prisma.event.findMany({
      orderBy: { rosterLocksAt: "desc" },
      include: {
        competition: true,
        discipline: true,
        category: true,
        slots: true,
        _count: { select: { registrations: true } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-50">
              ⚙️ Gestión de Eventos y Slots Fantasy
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Crea las pruebas de la competición y configura automáticamente los slots oficiales (Corto o Largo).
            </p>
          </div>

          {/* Barra de navegación */}
          <AdminNav />

          <Link
            href="/admin"
            className="text-xs bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 px-3 py-1.5 rounded-lg transition"
          >
            ← Panel Admin
          </Link>
        </div>

        {/* Gestor interactivo */}
        <EventsManager
          initialEvents={events}
          competitions={competitions}
          disciplines={disciplines}
          categories={categories}
        />

      </div>
    </div>
  );
}