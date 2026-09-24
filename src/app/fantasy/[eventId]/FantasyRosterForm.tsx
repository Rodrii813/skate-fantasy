"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getCountryFlag } from "@/lib/flags";

interface Skater {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
}

interface Registration {
  skaterId: string;
  startOrder: number | null;
  warmupGroup: number | null;
  skater: Skater;
}

interface Slot {
  id: string;
  label: string;
  order: number;
}

interface Props {
  eventId: string;
  eventName: string;
  rosterLocksAt: string;
  slots: Slot[];
  registrations: Registration[];
  initialPicks: Record<string, string>;
}

export default function FantasyRosterForm({
  eventId,
  eventName,
  rosterLocksAt,
  slots,
  registrations,
  initialPicks,
}: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Identificar si un slot es de Componentes (PCS)
  const isComponentSlot = (label: string) => {
    const l = label.toLowerCase();
    return (
      l.includes("skating") ||
      l.includes("transition") ||
      l.includes("performance") ||
      l.includes("composition") ||
      l.includes("choreo sequence") ||
      l.includes("pcs")
    );
  };

  const technicalSlots = useMemo(() => slots.filter((s) => !isComponentSlot(s.label)), [slots]);
  const componentSlots = useMemo(() => slots.filter((s) => isComponentSlot(s.label)), [slots]);

  // Agrupar registros por Warmup Group desc
  const groupedRegistrations = useMemo(() => {
    const groups: Record<number, Registration[]> = {};
    for (const reg of registrations) {
      const g = reg.warmupGroup || 1;
      if (!groups[g]) groups[g] = [];
      groups[g].push(reg);
    }

    for (const g in groups) {
      groups[g].sort((a, b) => (a.startOrder || 0) - (b.startOrder || 0));
    }

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a)
      .map((groupNum) => ({
        group: groupNum,
        skaters: groups[groupNum],
      }));
  }, [registrations]);

  const maxGroupNum = groupedRegistrations[0]?.group || 1;
  const secondMaxGroupNum = groupedRegistrations[1]?.group || 0;

  // 1. Conteo de uso por grupo en ELEMENTOS TÉCNICOS
  const techGroupUsage = useMemo(() => {
    const usage: Record<number, number> = {};
    for (const slot of technicalSlots) {
      const skaterId = picks[slot.id];
      if (skaterId) {
        const reg = registrations.find((r) => r.skaterId === skaterId);
        if (reg) {
          const g = reg.warmupGroup || 1;
          usage[g] = (usage[g] || 0) + 1;
        }
      }
    }
    return usage;
  }, [picks, technicalSlots, registrations]);

  // 2. Conteo de uso por grupo en COMPONENTES (máx 1 por grupo)
  const compGroupUsage = useMemo(() => {
    const usage: Record<number, number> = {};
    for (const slot of componentSlots) {
      const skaterId = picks[slot.id];
      if (skaterId) {
        const reg = registrations.find((r) => r.skaterId === skaterId);
        if (reg) {
          const g = reg.warmupGroup || 1;
          usage[g] = (usage[g] || 0) + 1;
        }
      }
    }
    return usage;
  }, [picks, componentSlots, registrations]);

  // Validación de reglas
  const validation = useMemo(() => {
    const totalSlots = slots.length;
    const filledCount = Object.values(picks).filter(Boolean).length;
    const missingSlots = totalSlots - filledCount;

    // Regla Técnico 1: No repetir patinadora dentro de los slots técnicos
    const techSkaterCounts: Record<string, number> = {};
    for (const slot of technicalSlots) {
      const sId = picks[slot.id];
      if (sId) techSkaterCounts[sId] = (techSkaterCounts[sId] || 0) + 1;
    }
    const repeatedTechSkater = Object.values(techSkaterCounts).some((c) => c > 1);

    // Regla Técnico 2: Máx 2 en los últimos 2 grupos
    const countTopGroup = techGroupUsage[maxGroupNum] || 0;
    const countSecondGroup = secondMaxGroupNum ? techGroupUsage[secondMaxGroupNum] || 0 : 0;
    const exceedsTopTech = countTopGroup > 2;
    const exceedsSecondTech = countSecondGroup > 2;

    // Regla Componentes: Máx 1 por Warmup Group en components
    const exceedsCompGroup = Object.entries(compGroupUsage).some(([_, count]) => count > 1);

    let errorMessage = "";
    if (missingSlots > 0) {
      errorMessage = `Faltan por rellenar ${missingSlots} ${missingSlots === 1 ? "slot" : "slots"}`;
    } else if (repeatedTechSkater) {
      errorMessage = "No puedes elegir a la misma patinadora en dos elementos técnicos";
    } else if (exceedsTopTech) {
      errorMessage = `Máximo 2 patinadoras técnicas en Warmup Group ${maxGroupNum} (llevas ${countTopGroup})`;
    } else if (exceedsSecondTech) {
      errorMessage = `Máximo 2 patinadoras técnicas en Warmup Group ${secondMaxGroupNum} (llevas ${countSecondGroup})`;
    } else if (exceedsCompGroup) {
      errorMessage = "En Componentes: Máximo 1 patinadora por cada grupo de calentamiento";
    }

    const isValid =
      missingSlots === 0 &&
      !repeatedTechSkater &&
      !exceedsTopTech &&
      !exceedsSecondTech &&
      !exceedsCompGroup;

    return {
      isValid,
      errorMessage,
      countTopGroup,
      countSecondGroup,
      exceedsTopTech,
      exceedsSecondTech,
      exceedsCompGroup,
    };
  }, [
    picks,
    slots,
    technicalSlots,
    componentSlots,
    techGroupUsage,
    compGroupUsage,
    maxGroupNum,
    secondMaxGroupNum,
  ]);

  const handleSelect = (slotId: string, skaterId: string) => {
    setPicks((prev) => ({
      ...prev,
      [slotId]: skaterId,
    }));
  };

  const handleSave = async () => {
    if (!validation.isValid) return;
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/fantasy/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          picks, // Enviamos el diccionario plano { [slotId]: skaterId }
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el equipo");

      setMsg({ type: "success", text: "✅ ¡Alineación guardada con éxito!" });
      router.refresh();
    } catch (err: any) {
      setMsg({ type: "error", text: `❌ ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <span className="text-xs text-slate-400 font-semibold">
          Deadline: {new Date(rosterLocksAt).toLocaleString("es-ES")}
        </span>
        <h1 className="text-xl font-black text-slate-100 mt-1">
          Technical Elements & Components: Draft Constraints
        </h1>
      </div>

      {/* Reglas Técnicas */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Normas Técnicas (Technical Elements)
        </h2>
        <div className="space-y-1 text-xs text-slate-300">
          <p className="flex items-center gap-1.5 font-medium">
            <span>⚠️</span> 1) Max 1 element per skater
          </p>
          <p className="flex items-center gap-1.5 font-medium">
            <span className="opacity-0">⚠️</span> 2) Max 2 elements in last 2 warmup groups
          </p>
        </div>

        {/* Contadores técnicos */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Warmup Group {maxGroupNum}:</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                validation.exceedsTopTech
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              {validation.countTopGroup}/2
            </span>
          </div>

          {secondMaxGroupNum > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Warmup Group {secondMaxGroupNum}:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                  validation.exceedsSecondTech
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {validation.countSecondGroup}/2
              </span>
            </div>
          )}
        </div>

        {/* Reglas Componentes */}
        <div className="pt-2 border-t border-slate-800/80">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            Normas de Componentes (Program Components)
          </h2>
          <p className="text-xs text-slate-300">
            ⭐ <strong>Max 1 element per warmup group:</strong> Cada componente debe ser de un grupo distinto. Puedes repetir patinadoras de la parte técnica.
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold ${
            msg.type === "success"
              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
              : "bg-red-950/60 text-red-300 border border-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 1. SECCIÓN ELEMENTOS TÉCNICOS */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
          Technical Elements
        </h2>
        {technicalSlots.map((slot) => {
          const currentSkaterId = picks[slot.id] || "";
          return (
            <div key={slot.id} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200 tracking-wide">
                {slot.label}
              </label>
              <div className="relative">
                <select
                  value={currentSkaterId}
                  onChange={(e) => handleSelect(slot.id, e.target.value)}
                  className="w-full bg-[#0d162e] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-xl p-3 appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                >
                  <option value="">Select skater for {slot.label}</option>
                  {groupedRegistrations.map(({ group, skaters }) => (
                    <optgroup key={group} label={`── Warmup Group ${group} ──`}>
                      {skaters.map((reg) => (
                        <option key={reg.skater.id} value={reg.skater.id}>
                          {reg.skater.firstName} {reg.skater.lastName} {getCountryFlag(reg.skater.country)} {reg.skater.country}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. SECCIÓN PROGRAM COMPONENTS */}
      {componentSlots.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-2">
            Program Components
          </h2>
          {componentSlots.map((slot) => {
            const currentSkaterId = picks[slot.id] || "";
            return (
              <div key={slot.id} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-200 tracking-wide">
                    {slot.label}
                  </label>
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-900">
                    Max 1 por grupo
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={currentSkaterId}
                    onChange={(e) => handleSelect(slot.id, e.target.value)}
                    className="w-full bg-[#0d162e] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-xl p-3 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  >
                    <option value="">Select skater for {slot.label}</option>
                    {groupedRegistrations.map(({ group, skaters }) => (
                      <optgroup key={group} label={`── Warmup Group ${group} ──`}>
                        {skaters.map((reg) => (
                          <option key={reg.skater.id} value={reg.skater.id}>
                            {reg.skater.firstName} {reg.skater.lastName} {getCountryFlag(reg.skater.country)} {reg.skater.country}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón y estado */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !validation.isValid}
          className={`w-full py-3.5 rounded-xl text-xs font-bold transition shadow-lg ${
            validation.isValid
              ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              : "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700/50"
          }`}
        >
          {saving
            ? "Guardando..."
            : validation.isValid
            ? "Guardar Alineación Oficial"
            : validation.errorMessage}
        </button>
        {!validation.isValid && (
          <p className="text-center text-[11px] text-amber-400 font-medium">
            ℹ️ {validation.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}