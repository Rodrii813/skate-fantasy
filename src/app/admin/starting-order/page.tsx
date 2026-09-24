import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import StartingOrderUploader from "./StartingOrderUploader";

export const dynamic = "force-dynamic";

export default async function AdminStartingOrderPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (user?.role !== "ADMIN") {
    redirect("/");
  }

  // Traer los eventos disponibles para el selector
  const events = await prisma.event.findMany({
    orderBy: { rosterLocksAt: "desc" },
    include: {
      competition: true,
      discipline: true,
      category: true,
      _count: { select: { registrations: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Barra superior con volver */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-50">
              📄 Cargar Orden de Salida (PDF)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sube actas oficiales de RFEP o World Skate para registrar automáticamente los patinadores y grupos de calentamiento.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-xs bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 px-3 py-1.5 rounded-lg transition"
          >
            ← Volver al Admin
          </Link>
        </div>

        {/* Componente interactivo de subida */}
        <StartingOrderUploader events={events} />

      </div>
    </div>
  );
}