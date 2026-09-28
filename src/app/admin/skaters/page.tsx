"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AdminNav from "../AdminNav";
import { normalizeName } from "@/lib/normalizeName";

interface Skater {
  id: string;
  firstName: string;
  lastName: string;
  country: string | null;
  disciplineId?: string | null;
  categoryId?: string | null;
  discipline?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  _count?: { registrations: number; elementScores: number };
}

export default function AdminSkatersPage() {
  const [skaters, setSkaters] = useState<Skater[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  // Edición / Creación
  const [editingSkater, setEditingSkater] = useState<Skater | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");

  const loadSkaters = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/skaters");
    const data = await res.json();
    if (Array.isArray(data)) setSkaters(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSkaters();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingSkater ? "PUT" : "POST";
    const body = editingSkater
      ? { id: editingSkater.id, firstName, lastName, country }
      : { firstName, lastName, country };

    const res = await fetch("/api/admin/skaters", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setFirstName("");
      setLastName("");
      setCountry("");
      setEditingSkater(null);
      loadSkaters();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Seguro que quieres eliminar a ${name}? Se borrarán también sus inscripciones y puntuaciones.`)) return;

    const res = await fetch(`/api/admin/skaters?id=${id}`, { method: "DELETE" });
    if (res.ok) loadSkaters();
  };

  const startEdit = (skater: Skater) => {
    setEditingSkater(skater);
    setFirstName(skater.firstName);
    setLastName(skater.lastName);
    setCountry(skater.country || "");
  };

  // Listas de disciplinas/categorías presentes, para los filtros
  const disciplines = useMemo(() => {
    const map = new Map<string, string>();
    skaters.forEach((s) => {
      if (s.discipline?.id) map.set(s.discipline.id, s.discipline.name);
    });
    return Array.from(map.entries());
  }, [skaters]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    skaters.forEach((s) => {
      if (s.category?.id) map.set(s.category.id, s.category.name);
    });
    return Array.from(map.entries());
  }, [skaters]);

  // Posibles duplicados: mismo nombre normalizado (sin acentos/espacios) +
  // misma disciplina + misma categoría. Esto es solo un aviso visual — no
  // borra ni fusiona nada automáticamente, para no arriesgar datos.
  const duplicateIds = useMemo(() => {
    const groups = new Map<string, string[]>();
    skaters.forEach((s) => {
      const key = [
        s.disciplineId || s.discipline?.id || "",
        s.categoryId || s.category?.id || "",
        normalizeName(s.firstName),
        normalizeName(s.lastName),
      ].join("|");
      const arr = groups.get(key) || [];
      arr.push(s.id);
      groups.set(key, arr);
    });
    const dupes = new Set<string>();
    groups.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    });
    return dupes;
  }, [skaters]);

  const filtered = skaters.filter((s) => {
    if (search && !`${s.firstName} ${s.lastName} ${s.country || ""}`.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (disciplineFilter && (s.disciplineId || s.discipline?.id) !== disciplineFilter) return false;
    if (categoryFilter && (s.categoryId || s.category?.id) !== categoryFilter) return false;
    if (onlyDuplicates && !duplicateIds.has(s.id)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-black text-slate-50">🛼 Gestión de Patinadores</h1>
            <p className="text-xs text-slate-400 mt-1">
              Edita nombres oficiales, elimina patinadores de prueba o añade patinadores nuevos.
            </p>
          </div>
          <Link
            href="/admin/events"
            className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg"
          >
            ← Volver a Eventos
          </Link>
        </div>

        {/* Formulario Crear / Editar */}
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              {editingSkater ? `✏️ Editar Patinador: ${editingSkater.firstName} ${editingSkater.lastName}` : "➕ Añadir Patinador"}
            </h2>
            {editingSkater && (
              <button
                type="button"
                onClick={() => {
                  setEditingSkater(null);
                  setFirstName("");
                  setLastName("");
                  setCountry("");
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input
              type="text"
              placeholder="Nombre (ej: Sira)"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
              required
            />
            <input
              type="text"
              placeholder="Apellidos (ej: Bella Gallardo)"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
              required
            />
            <input
              type="text"
              placeholder="País / Federación (ej: ESP / POR)"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
            />
          </div>

          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
          >
            {editingSkater ? "Actualizar Datos" : "Guardar Patinador"}
          </button>
        </form>

        {/* Buscador, filtros y Lista */}
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar patinador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              />
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">Todas las disciplinas</option>
                {disciplines.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">Todas las categorías</option>
                {categories.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyDuplicates}
                  onChange={(e) => setOnlyDuplicates(e.target.checked)}
                  className="accent-amber-500"
                />
                Solo posibles duplicados{duplicateIds.size > 0 ? ` (${duplicateIds.size})` : ""}
              </label>
            </div>
            <span className="text-xs text-slate-400">{filtered.length} patinadores encontrados</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
            {loading ? (
              <div className="p-4 text-xs text-center text-slate-400">Cargando lista...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-xs text-center text-slate-400">No hay patinadores registrados</div>
            ) : (
              filtered.map((s) => (
                <div key={s.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-850">
                  <div>
                    <span className="font-bold text-slate-100">
                      {s.firstName} {s.lastName}
                    </span>
                    {s.country && (
                      <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 font-semibold px-1.5 py-0.5 rounded">
                        {s.country}
                      </span>
                    )}
                    {s.discipline && (
                      <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        {s.discipline.name}
                      </span>
                    )}
                    {s.category && (
                      <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        {s.category.name}
                      </span>
                    )}
                    {duplicateIds.has(s.id) && (
                      <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.5 rounded">
                        ⚠ posible duplicado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(s)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)}
                      className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded text-[11px]"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
