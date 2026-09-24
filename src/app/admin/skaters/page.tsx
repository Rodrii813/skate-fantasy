"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminNav from "../AdminNav";

interface Skater {
  id: string;
  firstName: string;
  lastName: string;
  country: string | null;
  _count?: { registrations: number; elementScores: number };
}

export default function AdminSkatersPage() {
  const [skaters, setSkaters] = useState<Skater[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const filtered = skaters.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.country || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-black text-slate-50">⛸️ Gestión de Patinadores</h1>
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

        {/* Buscador y Lista */}
        <div className="space-y-3">
          <div className="flex justify-between items-center gap-4">
            <input
              type="text"
              placeholder="Buscar patinador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
            />
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