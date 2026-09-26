"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LocalDateTime from "@/app/_components/LocalDateTime";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

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

const statusClassName: Record<string, string> = {
  UPCOMING: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOCKED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  RESULTS_IN: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FINISHED: "bg-slate-700 text-slate-300 border-slate-600",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Rango de fechas legible tipo agenda: "24 – 28 sep 2026" si cae en el
// mismo mes, "24 sep – 3 oct 2026" si cruza de mes, con el año repetido
// solo si start y end caen en años distintos.
function formatDateRange(startDate: Date, endDate: Date, dateLocale: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const startLabel = start.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
}

export default function CompetitionsSearch({ competitions }: { competitions: CompetitionItem[] }) {
  const [query, setQuery] = useState("");
  const { locale } = useLocale();
  const t = getDictionary(locale).competitionsHub;
  const dateLocale = locale === "en" ? "en-US" : "es-ES";

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
          placeholder={t.searchPlaceholder}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-base">{t.noResults(query)}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((comp) => (
            <div
              key={comp.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-black/40 space-y-5"
            >
              {/* Cabecera de la Competición: el rango de fechas es lo
                  primero que se lee, tipo tarjeta de agenda, para que se
                  entienda de un vistazo "de tal fecha a tal fecha" sin
                  tener que hacer scroll ni leer letra pequeña. */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 bg-indigo-950/60 border border-indigo-800/50 rounded-xl px-3 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      {new Date(comp.startDate).toLocaleDateString(dateLocale, { month: "short" })}
                    </p>
                    <p className="text-xl font-black text-slate-50 leading-none mt-0.5">
                      {new Date(comp.startDate).getDate()}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-50 tracking-tight">{comp.name}</h2>
                    <p className="text-sm font-semibold text-indigo-300 mt-1">
                      📅 {formatDateRange(comp.startDate, comp.endDate, dateLocale)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">📍 {comp.location || t.officialSite}</p>
                  </div>
                </div>

                {comp.website && (
                  <a
                    href={comp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                  >
                    {t.website}
                  </a>
                )}
              </div>

              {/* Eventos / Categorías dentro de la competición */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t.scheduledEvents(comp.events.length)}
                </p>

                <div className="grid gap-3">
                  {comp.events.map((event) => {
                    const badgeLabel = t.status[event.status as keyof typeof t.status];
                    const badgeClass = statusClassName[event.status];
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
                            {badgeLabel && (
                              <span
                                className={`px-2.5 py-0.5 text-xs font-semibold border rounded-full ${badgeClass}`}
                              >
                                {badgeLabel}
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-slate-100">{event.name}</h3>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span>{t.registrations(event._count.registrations)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{t.predictionsSent(event._count.predictions)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>
                              {t.picksClose}{" "}
                              <LocalDateTime
                                value={event.rosterLocksAt}
                                options={{ dateStyle: "short", timeStyle: "short" }}
                              />
                            </span>
                          </div>
                        </div>

                        {/* Botones de acción directos. Con 3 textos largos, un
                            "sm:flex" en una sola fila desbordaba la tarjeta en
                            anchos intermedios (~640-900px): con flex-wrap, los
                            que no caben en la fila bajan a la siguiente en vez
                            de salirse del recuadro. En móvil ocupan el ancho
                            completo apilados; en escritorio se ajustan a su
                            contenido. */}
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                          <Link
                            href={`/competitions/${comp.id}?event=${event.id}`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition"
                          >
                            {t.hubAndResults}
                          </Link>

                          <Link
                            href={`/competitions/${comp.id}?cal=1`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition"
                          >
                            {t.calendarBtn}
                          </Link>

                          <Link
                            href={`/predictions?event=${event.id}`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            {t.predictionBtn}
                          </Link>

                          <Link
                            href={`/events/${event.id}`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            {t.fantasyBtn}
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
