"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "🏠 Inicio Admin" },
    { href: "/admin/competitions", label: "🏆 Competiciones" },
    { href: "/admin/events", label: "⚙️ Eventos y Slots" },
    { href: "/admin/skaters", label: "⛸️ Patinadores" },
    { href: "/admin/judges-details", label: "📊 Subir Resultados (PDF)" },
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-4 mb-6">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              isActive
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}