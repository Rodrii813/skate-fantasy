import Link from "next/link";
import AdminNav from "./AdminNav";

export default function AdminDashboardPage() {
  const sections = [
    {
      title: "🏆 Competiciones",
      desc: "Crea, edita o elimina campeonatos (fechas, sede, nombre).",
      href: "/admin/competitions",
      color: "border-blue-500/30 hover:border-blue-500",
    },
    {
      title: "⚙️ Eventos y Slots",
      desc: "Configura las pruebas (Senior Mujeres, Corto, Largo) y carga las plantillas oficiales.",
      href: "/admin/events",
      color: "border-emerald-500/30 hover:border-emerald-500",
    },
    {
      title: "⛸️ Patinadores",
      desc: "Lista de deportistas, borrado de patinadores falsos o corrección de nombres y países.",
      href: "/admin/skaters",
      color: "border-amber-500/30 hover:border-amber-500",
    },
    {
      title: "📊 Importar Resultados (PDF)",
      desc: "Sube las actas de Judges Details para computar puntuaciones automáticamente.",
      href: "/admin/judges-details",
      color: "border-purple-500/30 hover:border-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-50">🛠️ Panel de Control - Skate Fantasy</h1>
          <p className="text-xs text-slate-400 mt-1">Gestiona todo el torneo desde una sola pantalla sin necesidad de tocar rutas.</p>
        </div>

        <AdminNav />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((sec) => (
            <Link
              key={sec.href}
              href={sec.href}
              className={`p-5 rounded-2xl bg-slate-900 border transition flex flex-col justify-between space-y-2 ${sec.color}`}
            >
              <h2 className="text-base font-bold text-slate-100">{sec.title}</h2>
              <p className="text-xs text-slate-400">{sec.desc}</p>
              <span className="text-[11px] font-semibold text-indigo-400 mt-2 block">Acceder →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}