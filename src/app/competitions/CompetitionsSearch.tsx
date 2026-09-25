"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LocalDateTime from "@/app/_components/LocalDateTime";

interface EventItem {
  id: string;
  name: string;
  status: string;
  rosterLocksAt: Date;
  discipline: { name: string };
  category: { name: string };
  _count: { registrations: number; predictions: number };
}

interface CompetitionItem {
  id: string;
  name: string;
  location: string | null;
  website: string | null;
  startDate: Date;
  endDate: Date;
  events: EventItem[];
}

const statusBadge: Record<string, { label: string; className: string }> = {
  UPCOMING: {
    label: "Abierto",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  LOCKED: {
    label: "En Competición",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  RESULTS_IN: {
    label: "Resultados Parciales",
    className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  FINISHED: {
    label: "Finalizado",
    className: "bg-slate-700 text-slate-300 border-slate-600",
  },
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function CompetitionsSearch({ competitions }: { competitions: CompetitionItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return competitions;

    return competitions
      .map((comp) => {
        const compMatches = normalize(comp.name).includes(q) || normalize(comp.location || "").includes(q);
        if (compMatches) return comp;

        const matchingEvents = comp.events.filter(
          (ev) =>
            normalize(ev.name).includes(q) ||
            normalize(ev.discipline.name).includes(q) ||
            normalize(ev.category.name).includes(q)
        );
        if (matchingEvents.length === 0) return null;
        return { ...comp, events: matchingEvents };
      })
      .filter((c): c is CompetitionItem => c !== null);
  }, [competitions, query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar competición, prueba, disciplina o categoría…"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-base">Sin resultados para "{query}".</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((comp) => (
            <div
              key={comp.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-black/40 space-y-5"
            >
              {/* Cabecera de la Competición */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-50 tracking-tight">{comp.name}</h2>
                  <p className="text-sm text-slate-400 flex items-center gap-3 mt-1">
                    <span>📍 {comp.location || "Sede oficial"}</span>
                    <span>•</span>
                    <span>
                      📅 {new Date(comp.startDate).toLocaleDateString("es-ES")} –{" "}
                      {new Date(comp.endDate).toLocaleDateString("es-ES")}
                    </span>
                  </p>
                </div>

                {comp.website && (
                  <a
                    href={comp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                  >
                    Web oficial / Stream ↗
                  </a>
                )}
              </div>

              {/* Eventos / Categorías dentro de la competición */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pruebas y Categorías Programadas ({comp.events.length})
                </p>

                <div className="grid gap-3">
                  {comp.events.map((event) => {
                    const badge = statusBadge[event.status];
                    return (
                      <div
                        key={event.id}
                        className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/50 text-indigo-300">
                              {event.discipline.name}
                            </span>
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {event.category.name}
                            </span>
                            {badge && (
                              <span
                                className={`px-2.5 py-0.5 text-xs font-semibold border rounded-full ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-slate-100">{event.name}</h3>

                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>👥 {event._count.registrations} patinadores inscritos</span>
                            <span>•</span>
                            <span>🎯 {event._count.predictions} porras enviadas</span>
                            <span>•</span>
                            <span>
                              Cierre de picks:{" "}
                              <LocalDateTime
                                value={event.rosterLocksAt}
                                options={{ dateStyle: "short", timeStyle: "short" }}
                              />
                            </span>
                          </div>
                        </div>

                        {/* Botones de acción directos */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <Link
                            href={`/competitions/${comp.id}?event=${event.id}`}
                            className="flex-1 md:flex-none text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition"
                          >
                            Hub y Resultados
                          </Link>

                          <Link
                            href={`/predictions?event=${event.id}`}
                            className="flex-1 md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            🎯 Porra Top 3/5
                          </Link>

                          <Link
                            href={`/events/${event.id}`}
                            className="flex-1 md:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            ✨ Fantasy
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
