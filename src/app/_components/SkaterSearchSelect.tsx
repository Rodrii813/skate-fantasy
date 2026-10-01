"use client";

import { useEffect, useRef, useState } from "react";
import { countryFlagEmoji } from "@/lib/countryFlags";

export interface SkaterSearchOption {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  // Para Predicciones: una patinadora ya elegida en otro puesto se muestra
  // pero no se puede volver a seleccionar — igual que antes con <option disabled>.
  disabled?: boolean;
  disabledLabel?: string;
}

export interface SkaterSearchGroup {
  // null = sin cabecera de grupo (lista plana, como en Predicciones). Con
  // texto = cabecera tipo "Grupo de Calentamiento 3" (como en Fantasy).
  label: string | null;
  options: SkaterSearchOption[];
}

interface Props {
  value: string;
  onChange: (skaterId: string) => void;
  groups: SkaterSearchGroup[];
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  disabled?: boolean;
  ringColorClass?: string;
}

// Desplegable con buscador para elegir patinador/a, agrupado por grupo de
// calentamiento (Fantasy) o en lista plana (Predicciones) — pensado para
// listas largas (una prueba de World Skate Games puede tener 30-40
// inscritas) donde desplazarse por un <select> nativo entero es lento.
// Reemplaza el <select>/<option> de toda la vida por un botón + panel propio
// (criterio: lo que no es nativo pierde accesibilidad de teclado "gratis",
// así que aquí se cubre a mano Escape para cerrar y clic fuera para cerrar;
// no se ha montado navegación con flechas porque el buscador ya reduce la
// lista a pocos resultados en cuanto se escribe algo).
export default function SkaterSearchSelect({
  value,
  onChange,
  groups,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  disabled = false,
  ringColorClass = "focus:ring-indigo-500",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Pequeño delay vía rAF: el input todavía no existe en el DOM en el
      // mismo tick en que se pone open=true.
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  const allOptions = groups.flatMap((g) => g.options);
  const selected = allOptions.find((o) => o.id === value);
  const selectedFlag = selected ? countryFlagEmoji(selected.country) : "";

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = normalizedQuery
    ? groups
        .map((g) => ({
          ...g,
          options: g.options.filter((o) =>
            `${o.firstName} ${o.lastName} ${o.country}`.toLowerCase().includes(normalizedQuery)
          ),
        }))
        .filter((g) => g.options.length > 0)
    : groups;

  const hasResults = filteredGroups.some((g) => g.options.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-[#0d162e] border border-slate-800 hover:border-slate-700 text-left text-xs rounded-xl p-3 focus:outline-none focus:ring-1 ${ringColorClass} transition disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${selected ? "text-slate-200" : "text-slate-500"}`}>
          {selected ? (
            <>
              {selectedFlag && <span className="mr-1.5">{selectedFlag}</span>}
              {selected.firstName} {selected.lastName}
              {selected.country && <span className="text-slate-500"> ({selected.country})</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="shrink-0 text-slate-400">▼</span>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-[#0d162e] border border-slate-700 rounded-xl shadow-xl shadow-black/50 overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center gap-2 bg-[#070b18] border border-slate-800 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-500 text-xs">🔍</span>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {!hasResults ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">{noResultsLabel}</p>
            ) : (
              filteredGroups.map((group, gi) => (
                <div key={group.label ?? `group-${gi}`}>
                  {group.label && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {group.label}
                    </p>
                  )}
                  {group.options.map((opt) => {
                    const isSelected = opt.id === value;
                    const flag = countryFlagEmoji(opt.country);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => {
                          if (opt.disabled) return;
                          onChange(opt.id);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition ${
                          opt.disabled
                            ? "text-slate-600 cursor-not-allowed"
                            : isSelected
                            ? "bg-blue-600 text-white"
                            : "text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {flag && <span className="shrink-0">{flag}</span>}
                          <span className="truncate">
                            {opt.firstName} {opt.lastName}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[10px] ${isSelected ? "text-indigo-100" : "text-slate-500"}`}
                        >
                          {opt.disabled && opt.disabledLabel ? opt.disabledLabel : opt.country}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
