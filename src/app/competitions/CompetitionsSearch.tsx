"use client";

import { useEffect, useMemo, useState } from "react";
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

// Colores de estado con algo más de opacidad/borde para que resalten sobre
// el fondo rink en vez del gris slate anterior — los tonos semánticos
// (verde/ámbar/cian/gris) se mantienen porque ya se entienden bien, solo se
// ajusta el fondo/negro de base al resto de tarjetas de esta pantalla.
const statusClassName: Record<string, string> = {
  UPCOMING: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOCKED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  RESULTS_IN: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FINISHED: "bg-white/10 text-ice-100/70 border-white/15",
};

// Cuántas competiciones se muestran de entrada, y cuántas más se añaden
// cada vez que se pulsa "Cargar más". Evita que la página crezca sin límite
// según se vayan añadiendo competiciones y temporadas.
const PAGE_SIZE = 6;

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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { locale } = useLocale();
  const t = getDictionary(locale).competitionsHub;
  const dateLocale = locale === "en" ? "en-US" : "es-ES";

  // Estados y temporadas realmente presentes en los datos — así los chips de
  // filtro no muestran opciones vacías, y en cuanto haya varias temporadas
  // (años distintos) aparece solo entonces el filtro de temporada.
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    competitions.forEach((c) => c.events.forEach((e) => set.add(e.status)));
    return Array.from(set);
  }, [competitions]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    competitions.forEach((c) => set.add(new Date(c.startDate).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [competitions]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());

    return competitions
      .map((comp) => {
        if (yearFilter !== null && new Date(comp.startDate).getFullYear() !== yearFilter) return null;

        const compTextMatches = !q || normalize(comp.name).includes(q) || normalize(comp.location || "").includes(q);

        const matchingEvents = comp.events.filter((ev) => {
          if (statusFilter && ev.status !== statusFilter) return false;
          if (compTextMatches) return true;
          return (
            normalize(ev.name).includes(q) ||
            normalize(ev.discipline.name).includes(q) ||
            normalize(ev.category.name).includes(q)
          );
        });

        if (matchingEvents.length === 0) return null;
        return { ...comp, events: matchingEvents };
      })
      .filter((c): c is CompetitionItem => c !== null);
  }, [competitions, query, statusFilter, yearFilter]);

  // Si cambia la búsqueda o los filtros, se vuelve a empezar por la primera
  // "página" de resultados en vez de mantener un contador que ya no
  // corresponde a la lista filtrada.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, statusFilter, yearFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-ice-50 placeholder:text-ice-100/40 focus:outline-none focus:border-gold"
        />

        {/* Filtro por estado: chips en vez de un <select> para que se vea de
            un vistazo cuántos estados hay y cuál está activo, y para que sea
            cómodo de tocar en móvil. */}
        {availableStatuses.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ice-100/50 mr-1">{t.filterStatusLabel}</span>
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                statusFilter === null
                  ? "bg-gold/15 border-gold/40 text-gold"
                  : "bg-white/5 border-white/15 text-ice-100/60 hover:border-white/30"
              }`}
            >
              {t.filterAll}
            </button>
            {availableStatuses.map((status) => {
              const label = t.status[status as keyof typeof t.status];
              if (!label) return null;
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(active ? null : status)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    active
                      ? "bg-gold/15 border-gold/40 text-gold"
                      : "bg-white/5 border-white/15 text-ice-100/60 hover:border-white/30"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Filtro por temporada/año: solo aparece cuando ya hay competiciones
            de más de un año, para no añadir ruido con una única opción. */}
        {availableYears.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ice-100/50 mr-1">{t.filterYearLabel}</span>
            <button
              type="button"
              onClick={() => setYearFilter(null)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                yearFilter === null
                  ? "bg-gold/15 border-gold/40 text-gold"
                  : "bg-white/5 border-white/15 text-ice-100/60 hover:border-white/30"
              }`}
            >
              {t.filterAll}
            </button>
            {availableYears.map((year) => {
              const active = yearFilter === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setYearFilter(active ? null : year)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    active
                      ? "bg-gold/15 border-gold/40 text-gold"
                      : "bg-white/5 border-white/15 text-ice-100/60 hover:border-white/30"
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-ice-100/60 text-base">{t.noResults(query)}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visible.map((comp) => (
            <div
              key={comp.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/40 space-y-5"
            >
              {/* Cabecera de la Competición: el rango de fechas es lo
                  primero que se lee, tipo tarjeta de agenda, para que se
                  entienda de un vistazo "de tal fecha a tal fecha" sin
                  tener que hacer scroll ni leer letra pequeña. */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 bg-gold/10 border border-gold/30 rounded-xl px-3 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                      {new Date(comp.startDate).toLocaleDateString(dateLocale, { month: "short" })}
                    </p>
                    <p className="text-xl font-black text-white leading-none mt-0.5">
                      {new Date(comp.startDate).getDate()}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white tracking-tight">{comp.name}</h2>
                    <p className="text-sm font-semibold text-gold mt-1">
                      📅 {formatDateRange(comp.startDate, comp.endDate, dateLocale)}
                    </p>
                    <p className="text-xs text-ice-100/50 mt-1">📍 {comp.location || t.officialSite}</p>
                  </div>
                </div>

                {comp.website && (
                  <a
                    href={comp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent/80 underline underline-offset-4"
                  >
                    {t.website}
                  </a>
                )}
              </div>

              {/* Eventos / Categorías dentro de la competición */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ice-100/50">
                  {t.scheduledEvents(comp.events.length)}
                </p>

                <div className="grid gap-3">
                  {comp.events.map((event) => {
                    const badgeLabel = t.status[event.status as keyof typeof t.status];
                    const badgeClass = statusClassName[event.status];
                    return (
                      <div
                        key={event.id}
                        className="bg-black/20 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent">
                              {event.discipline.name}
                            </span>
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-white/10 text-ice-100/70 border border-white/15">
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

                          <h3 className="text-lg font-bold text-white">{event.name}</h3>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ice-100/50">
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
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-white/10 hover:bg-white/15 text-ice-100/90 text-xs font-semibold px-3.5 py-2 rounded-lg border border-white/15 transition"
                          >
                            {t.hubAndResults}
                          </Link>

                          <Link
                            href={`/competitions/${comp.id}?cal=1`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-white/10 hover:bg-white/15 text-ice-100/90 text-xs font-semibold px-3.5 py-2 rounded-lg border border-white/15 transition"
                          >
                            {t.calendarBtn}
                          </Link>

                          <Link
                            href={`/predictions?event=${event.id}`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-accent hover:bg-accent/90 text-rink text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            {t.predictionBtn}
                          </Link>

                          <Link
                            href={`/events/${event.id}`}
                            className="flex-1 min-w-[140px] md:flex-none text-center bg-gold hover:bg-gold/90 text-rink text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
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

          {/* Paginación tipo "cargar más": todos los datos ya están en el
              cliente (vienen de una sola consulta en el servidor), así que
              en vez de re-pedir páginas al servidor simplemente se revela
              más de la lista ya filtrada. Suficiente para que la pantalla no
              se vuelva interminable según se añadan competiciones, sin tener
              que tocar la consulta de Prisma ni añadir un parámetro de
              página en la URL. */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <p className="text-xs text-ice-100/40">{t.showingCount(visible.length, filtered.length)}</p>
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="text-sm font-semibold bg-white/5 border border-white/15 text-ice-100/80 px-5 py-2.5 rounded-xl hover:border-gold hover:text-gold transition"
              >
                {t.loadMore}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
