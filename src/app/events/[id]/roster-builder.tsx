"use client";

import { useState } from "react";

type Slot = {
  id: string;
  label: string;
  elementCategoryName: string;
  segmentName: string | null;
};
type Skater = { id: string; name: string; country: string };

export default function RosterBuilder({
  eventId,
  locked,
  slots,
  skaters,
  initialPicks,
}: {
  eventId: string;
  locked: boolean;
  slots: Slot[];
  skaters: Skater[];
  initialPicks: { slotId: string; skaterId: string }[];
}) {
  const initialMap: Record<string, string> = {};
  for (const p of initialPicks) initialMap[p.slotId] = p.skaterId;

  const [picks, setPicks] = useState<Record<string, string>>(initialMap);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const complete = slots.every((s) => picks[s.id]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        picks: Object.entries(picks).map(([slotId, skaterId]) => ({ slotId, skaterId })),
      }),
    });
    const data = await res.json();
    setSaving(false);
    setMessage(res.ok ? "Equipo guardado." : data.error ?? "Error al guardar.");
  }

  if (locked) {
    return (
      <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-ice-100/70">
        El plazo para elegir patinadores en este evento ya ha cerrado.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {slots.map((slot) => (
        <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-medium text-white">{slot.label}</p>
          <p className="text-xs text-ice-100/50">
            {slot.elementCategoryName}
            {slot.segmentName ? ` · ${slot.segmentName}` : ""}
          </p>
          <select
            value={picks[slot.id] ?? ""}
            onChange={(e) => setPicks((prev) => ({ ...prev, [slot.id]: e.target.value }))}
            className="mt-3 w-full rounded-lg border border-white/15 bg-rink px-3 py-2 text-white outline-none focus:border-gold"
          >
            <option value="">Elige un patinador...</option>
            {skaters.map((sk) => (
              <option key={sk.id} value={sk.id}>
                {sk.name} ({sk.country})
              </option>
            ))}
          </select>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={!complete || saving}
        className="rounded-full bg-gold px-6 py-2.5 font-semibold text-rink hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar equipo"}
      </button>
      {!complete && (
        <p className="text-sm text-ice-100/50">Elige un patinador para cada hueco antes de guardar.</p>
      )}
      {message && <p className="text-sm text-accent">{message}</p>}
    </div>
  );
}
