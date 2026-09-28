"use client";

import { useMemo, useState } from "react";
import { useTimezone } from "./TimezoneProvider";
import { VENUE_TIMEZONE } from "@/lib/timezone";
import { groupCalendarRowsByVenueDay, type CalendarRow } from "@/lib/calendarGrouping";

// Cada fila del calendario ya viene renderizada desde el Server Component
// (con sus botones de Predicción/Draft/Resultados, traducciones, etc.) — este
// componente solo decide en QUÉ DÍA cae cada una y las agrupa, porque eso
// depende de la zona horaria de quien mira la página (ver el comentario en
// groupCalendarRowsByVenueDay). `node` es el <li>...</li> ya construido.
//
// Los campos competitionName/disciplineName/status son opcionales: solo
// /calendario los rellena (para poder ofrecer los filtros de abajo); la
// vista de /competitions/[id] los deja vacíos porque ahí todas las filas ya
// son de la misma competición.
export interface CalendarDayRow {
  key: string;
  scheduledAt: string;
  node: React.ReactNode;
  competitionName?: string;
  disciplineName?: string;
  status?: string;
}

// Textos y etiquetas para la barra de filtros y los botones de
// expandir/colapsar. Es opcional a propósito: cuando no se pasa (p.ej. desde
// /competitions/[id]) el componente se comporta como antes, sin filtros y
// con todos los días desplegados sin posibilidad de colapsarlos por
// separado — solo /calendario necesita esto, porque es donde de verdad se
// acumulan muchos eventos.
export interface CalendarControls {
  // Opcional: solo hace falta cuando la lista de filas puede abarcar más de
  // una competición (p.ej. /calendario). En /competitions/[id], donde todas
  // las filas son siempre de la MISMA competición, el filtro de competición
  // nunca llega a mostrarse (competitionOptions.length nunca pasa de 1), así
  // que no tiene sentido obligar a pasar esta etiqueta ahí.
  filterCompetitionLabel?: string;
  filterDisciplineLabel: string;
  filterStatusLabel: string;
  filterAllLabel: string;
  expandAllLabel: string;
  collapseAllLabel: string;
  noResultsFilter: string;
  statusText: Record<string, string>;
}

/**
 * Agrupa filas de calendario por día SEGÚN LA ZONA HORARIA de quien mira la
 * página, no la de la sede — un evento a las 20:00 en Paraguay es ya la
 * madrugada del día siguiente en España, y antes salía encuadrado en el día
 * de Paraguay aunque la hora mostrada (vía <LocalDateTime>) fuera la
 * española, lo cual desconcertaba ("sale a las 01:00 pero está en el bloque
 * del sábado"). Antes de montar en el cliente no se conoce esa zona (mismo
 * problema que <LocalDateTime>), así que se usa la de la sede como
 * marcador estable para que el HTML del servidor y el del cliente coincidan,
 * y se reagrupa con la zona real en cuanto se monta.
 *
 * Cada bloque de día es ahora desplegable (se puede colapsar haciendo clic
 * en su cabecera) y, cuando se pasa `controls`, aparece encima una barra de
 * filtros (competición / disciplina / estado) más botones para
 * expandir/colapsar todos los días de golpe — pensado para calendarios con
 * muchos eventos, donde desplazarse por todo se hace largo.
 */
export default function CalendarDayGroups({
  rows,
  emptyMessage,
  sectionClassName = "mt-8",
  headingClassName = "font-display text-lg font-semibold capitalize text-white",
  listClassName = "mt-3 space-y-2",
  controls,
}: {
  rows: CalendarDayRow[];
  emptyMessage?: React.ReactNode;
  sectionClassName?: string;
  headingClassName?: string;
  listClassName?: string;
  controls?: CalendarControls;
}) {
  const { timeZone, mounted } = useTimezone();
  const effectiveTimeZone = mounted ? timeZone : VENUE_TIMEZONE;

  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const competitionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.competitionName && set.add(r.competitionName));
    return Array.from(set).sort();
  }, [rows]);

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.disciplineName && set.add(r.disciplineName));
    return Array.from(set).sort();
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.status && set.add(r.status));
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!controls) return rows;
    return rows.filter((r) => {
      if (competitionFilter !== "all" && r.competitionName !== competitionFilter) return false;
      if (disciplineFilter !== "all" && r.disciplineName !== disciplineFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, controls, competitionFilter, disciplineFilter, statusFilter]);

  const groups = useMemo(() => {
    const calendarRows: CalendarRow<CalendarDayRow>[] = filteredRows.map((row) => ({
      scheduledAt: new Date(row.scheduledAt),
      rowLabel: null,
      segmentId: null,
      event: row,
    }));
    return groupCalendarRowsByVenueDay(calendarRows, effectiveTimeZone);
  }, [filteredRows, effectiveTimeZone]);

  function toggleDay(key: string) {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtersActive =
    competitionFilter !== "all" || disciplineFilter !== "all" || statusFilter !== "all";

  if (groups.length === 0) {
    if (controls && filtersActive) {
      return <p className="mt-8 text-ice-100/60">{controls.noResultsFilter}</p>;
    }
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  return (
    <>
      {controls && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
          {competitionOptions.length > 1 && (
            <label className="flex items-center gap-2 text-ice-100/60">
              {controls.filterCompetitionLabel}
              <select
                value={competitionFilter}
                onChange={(e) => setCompetitionFilter(e.target.value)}
                className="rounded-lg border border-white/15 bg-transparent px-2 py-1 text-ice-100/90"
              >
                <option value="all">{controls.filterAllLabel}</option>
                {competitionOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          {disciplineOptions.length > 1 && (
            <label className="flex items-center gap-2 text-ice-100/60">
              {controls.filterDisciplineLabel}
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="rounded-lg border border-white/15 bg-transparent px-2 py-1 text-ice-100/90"
              >
                <option value="all">{controls.filterAllLabel}</option>
                {disciplineOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}
          {statusOptions.length > 1 && (
            <label className="flex items-center gap-2 text-ice-100/60">
              {controls.filterStatusLabel}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-white/15 bg-transparent px-2 py-1 text-ice-100/90"
              >
                <option value="all">{controls.filterAllLabel}</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {controls.statusText[s] || s}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsedDays(new Set())}
              className="rounded-lg border border-white/15 px-2.5 py-1 text-ice-100/70 transition hover:border-white/30 hover:text-white"
            >
              {controls.expandAllLabel}
            </button>
            <button
              type="button"
              onClick={() => setCollapsedDays(new Set(groups.map((g) => g.key)))}
              className="rounded-lg border border-white/15 px-2.5 py-1 text-ice-100/70 transition hover:border-white/30 hover:text-white"
            >
              {controls.collapseAllLabel}
            </button>
          </div>
        </div>
      )}

      {groups.map((group) => {
        const isCollapsed = collapsedDays.has(group.key);
        return (
          <section key={group.key} className={sectionClassName}>
            <h2 className="m-0">
              <button
                type="button"
                onClick={() => toggleDay(group.key)}
                aria-expanded={!isCollapsed}
                className={`flex w-full items-center justify-between gap-2 text-left ${headingClassName}`}
              >
                <span>
                  {group.label}{" "}
                  <span className="ml-1 text-sm font-normal normal-case text-ice-100/40">
                    ({group.events.length})
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm text-ice-100/50 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </h2>
            {!isCollapsed && (
              <ul className={listClassName}>
                {group.events.map((row) => (
                  <li key={row.event.key}>{row.event.node}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
