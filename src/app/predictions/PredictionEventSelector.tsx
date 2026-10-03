"use client";

import Link from "next/link";
import { useState } from "react";

// Selector de evento de /predictions, paso 2: antes se enseñaban TODAS las
// disciplinas desplegadas a la vez (cada una con su fila de botones), lo que
// con una competición grande (World Skate Games, varias disciplinas) ocupaba
// muchísimo alto de página antes de llegar al formulario. Ahora es el mismo
// patrón de pestañas por disciplina que ya usan el Fantasy Hub (RankMatrix,
// DraftStatusAccordion) y el Draft Room: una tira de pestañas deslizable en
// horizontal y, debajo, solo los eventos de la disciplina activa.

export interface PredictionEventOption {
  id: string;
  href: string;
  label: string;
  isActive: boolean;
  isTest: boolean;
}

export interface PredictionEventGroup {
  disciplineName: string;
  events: PredictionEventOption[];
}

export default function PredictionEventSelector({ groups }: { groups: PredictionEventGroup[] }) {
  // Pestaña activa por defecto: la disciplina que contiene el evento ya
  // seleccionado (si lo hay), si no la primera.
  const [activeKey, setActiveKey] = useState<string>(() => {
    const groupWithSelection = groups.find((g) => g.events.some((e) => e.isActive));
    return groupWithSelection?.disciplineName ?? groups[0]?.disciplineName ?? "";
  });

  const activeGroup = groups.find((g) => g.disciplineName === activeKey) ?? groups[0];

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {groups.map((g) => (
          <button
            key={g.disciplineName}
            type="button"
            onClick={() => setActiveKey(g.disciplineName)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
              g.disciplineName === activeGroup?.disciplineName
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {g.disciplineName} <span className="font-normal normal-case opacity-60">({g.events.length})</span>
          </button>
        ))}
      </div>

      {activeGroup && (
        <div className="flex flex-wrap gap-2 pt-3">
          {activeGroup.events.map((e) => (
            <Link
              key={e.id}
              href={e.href}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                e.isActive
                  ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/20"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              {e.label}
              {e.isTest && <span className="ml-1 text-amber-400">🧪</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
