"use client";

import { useRouter } from "next/navigation";

// Desplegable aparte para competiciones ya terminadas (fecha de fin en el
// pasado), separado de las pestañas de competiciones activas — con varias
// temporadas acumuladas, mezclarlas todas como pestañas haría esa fila
// interminable. `key` en el <select> fuerza que se reinicie su valor
// seleccionado cuando cambia la competición activa (p.ej. al elegir una
// pestaña activa, el desplegable vuelve a mostrar el placeholder).
export default function ArchivedCompetitionSelect({
  competitions,
  selectedId,
  placeholder,
}: {
  competitions: { id: string; name: string }[];
  selectedId: string | null;
  placeholder: string;
}) {
  const router = useRouter();

  if (competitions.length === 0) return null;

  return (
    <select
      key={selectedId ?? "none"}
      defaultValue={selectedId ?? ""}
      onChange={(e) => {
        if (e.target.value) router.push(`/fantasy?competition=${e.target.value}`);
      }}
      className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <option value="">{placeholder}</option>
      {competitions.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
