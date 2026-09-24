"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Skater {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
}

interface PredictionFormProps {
  eventId: string;
  isLocked: boolean;
  skaters: Skater[];
  initialPrediction?: {
    rank1SkaterId: string;
    rank2SkaterId: string;
    rank3SkaterId: string;
    rank4SkaterId?: string | null;
    rank5SkaterId?: string | null;
  } | null;
}

export default function PredictionForm({
  eventId,
  isLocked,
  skaters,
  initialPrediction,
}: PredictionFormProps) {
  const router = useRouter();

  const [rank1, setRank1] = useState(initialPrediction?.rank1SkaterId || "");
  const [rank2, setRank2] = useState(initialPrediction?.rank2SkaterId || "");
  const [rank3, setRank3] = useState(initialPrediction?.rank3SkaterId || "");
  const [rank4, setRank4] = useState(initialPrediction?.rank4SkaterId || "");
  const [rank5, setRank5] = useState(initialPrediction?.rank5SkaterId || "");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const selectedList = [rank1, rank2, rank3, rank4, rank5];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          rank1SkaterId: rank1,
          rank2SkaterId: rank2,
          rank3SkaterId: rank3,
          rank4SkaterId: rank4 || null,
          rank5SkaterId: rank5 || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar la porra");
      }

      setMessage({ text: "¡Porra guardada correctamente! 🎉", error: false });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setLoading(false);
    }
  };

  const renderSelect = (
    label: string,
    badge: string,
    value: string,
    onChange: (val: string) => void,
    required: boolean = true
  ) => {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold font-mono px-3 py-1 bg-slate-800 rounded-lg text-slate-200 border border-slate-700">
            {badge}
          </span>
          <div>
            <span className="font-semibold text-slate-200 text-sm">{label}</span>
            {required && <span className="text-amber-400 text-xs ml-1">*</span>}
          </div>
        </div>

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked || loading}
          className="w-full sm:w-72 bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          required={required}
        >
          <option value="">-- Elige un patinador --</option>
          {skaters.map((s) => {
            const isAlreadyChosen = selectedList.includes(s.id) && s.id !== value;
            return (
              <option key={s.id} value={s.id} disabled={isAlreadyChosen}>
                {s.firstName} {s.lastName} ({s.country}) {isAlreadyChosen ? "— Ya elegido" : ""}
              </option>
            );
          })}
        </select>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            message.error
              ? "bg-red-500/15 border border-red-500/30 text-red-400"
              : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {renderSelect("Medalla de Oro (1º Puesto)", "🥇 1º", rank1, setRank1, true)}
        {renderSelect("Medalla de Plata (2º Puesto)", "🥈 2º", rank2, setRank2, true)}
        {renderSelect("Medalla de Bronce (3º Puesto)", "🥉 3º", rank3, setRank3, true)}
        {renderSelect("4º Puesto (Top 5)", "4º", rank4, setRank4, false)}
        {renderSelect("5º Puesto (Top 5)", "5º", rank5, setRank5, false)}
      </div>

      {!isLocked && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-900/30 text-sm"
          >
            {loading ? "Guardando porra..." : initialPrediction ? "Actualizar mi Porra" : "Guardar mi Porra"}
          </button>
        </div>
      )}
    </form>
  );
}