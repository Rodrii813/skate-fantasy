"use client";

import { useState, useEffect } from "react";
import AdminNav from "../AdminNav";

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadCompetitions = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/competitions");
    const data = await res.json();
    if (Array.isArray(data)) setCompetitions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadCompetitions();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const body = editingId
      ? { id: editingId, name, location, startDate, endDate }
      : { name, location, startDate, endDate };

    const res = await fetch("/api/admin/competitions", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setName("");
      setLocation("");
      setStartDate("");
      setEndDate("");
      setEditingId(null);
      loadCompetitions();
    }
  };

  const handleEdit = (comp: any) => {
    setEditingId(comp.id);
    setName(comp.name);
    setLocation(comp.location || "");
    setStartDate(comp.startDate ? comp.startDate.substring(0, 10) : "");
    setEndDate(comp.endDate ? comp.endDate.substring(0, 10) : "");
  };

  const handleDelete = async (id: string, compName: string) => {
    if (!confirm(`¿Eliminar la competición "${compName}" y todos sus eventos asociados?`)) return;
    const res = await fetch(`/api/admin/competitions?id=${id}`, { method: "DELETE" });
    if (res.ok) loadCompetitions();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-black text-slate-50">🏆 Gestión de Competiciones</h1>
          <p className="text-xs text-slate-400 mt-1">Crea nuevos campeonatos, modifica sedes/fechas o elimínalos.</p>
        </div>

        <AdminNav />

        {/* Formulario */}
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            {editingId ? "✏️ Editar Competición" : "➕ Crear Competición"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <input
              type="text"
              placeholder="Nombre del Campeonato (ej: Artistic Skating European Championship)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 md:col-span-2"
              required
            />
            <input
              type="text"
              placeholder="Sede / Ciudad (ej: Ponte di Legno)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 md:col-span-2"
            />
            <div className="space-y-1">
              <label className="text-slate-400 text-[11px]">Fecha de Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 text-[11px]">Fecha de Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
            >
              {editingId ? "Guardar Cambios" : "Crear Campeonato"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setLocation("");
                  setStartDate("");
                  setEndDate("");
                }}
                className="bg-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Campeonatos Registrados ({competitions.length})
          </h2>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
            {loading ? (
              <div className="p-4 text-xs text-center text-slate-400">Cargando competiciones...</div>
            ) : competitions.length === 0 ? (
              <div className="p-4 text-xs text-center text-slate-400">No hay competiciones creadas todavía.</div>
            ) : (
              competitions.map((c) => (
                <div key={c.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">{c.name}</h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      📍 {c.location || "Sin sede"} • {c._count?.events || 0} pruebas vinculadas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(c)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
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