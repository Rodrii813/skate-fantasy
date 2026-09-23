"use client";

import { useState } from "react";

type Column = {
  segmentId: string;
  segmentName: string;
  elementCategoryId: string;
  elementCategoryName: string;
};
type Registration = { registrationId: string; skaterName: string; country: string };
type Score = { registrationId: string; segmentId: string; elementCategoryId: string; value: number };

export default function ResultsGrid({
  registrations,
  columns,
  existingScores,
}: {
  registrations: Registration[];
  columns: Column[];
  existingScores: Score[];
}) {
  const key = (regId: string, segId: string, ecId: string) => `${regId}__${segId}__${ecId}`;

  const initial: Record<string, string> = {};
  for (const s of existingScores) {
    initial[key(s.registrationId, s.segmentId, s.elementCategoryId)] = String(s.value);
  }
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function saveCell(registrationId: string, col: Column) {
    const k = key(registrationId, col.segmentId, col.elementCategoryId);
    const raw = values[k];
    if (raw === undefined || raw === "") return;
    const value = Number(raw);
    if (Number.isNaN(value)) return;

    setSavingKey(k);
    await fetch("/api/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationId,
        segmentId: col.segmentId,
        elementCategoryId: col.elementCategoryId,
        value,
      }),
    });
    setSavingKey(null);
    setSavedKey(k);
    setTimeout(() => setSavedKey(null), 1200);
  }

  if (columns.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-ice-100/70">
        Este evento no tiene slots con segmento asignado todavía. Créalos en Prisma Studio antes
        de cargar resultados.
      </p>
    );
  }

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-ice-100/50">
            <th className="px-3 py-2 font-medium">Patinador</th>
            {columns.map((c) => (
              <th key={c.segmentId + c.elementCategoryId} className="px-3 py-2 font-medium">
                {c.segmentName}
                <br />
                <span className="text-xs text-ice-100/40">{c.elementCategoryName}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registrations.map((r) => (
            <tr key={r.registrationId} className="rounded-xl bg-white/[0.03]">
              <td className="whitespace-nowrap rounded-l-xl px-3 py-2 text-white">
                {r.skaterName} <span className="text-ice-100/40">({r.country})</span>
              </td>
              {columns.map((c, idx) => {
                const k = key(r.registrationId, c.segmentId, c.elementCategoryId);
                const isLast = idx === columns.length - 1;
                return (
                  <td key={k} className={`px-3 py-2 ${isLast ? "rounded-r-xl" : ""}`}>
                    <input
                      type="number"
                      step="0.01"
                      value={values[k] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [k]: e.target.value }))}
                      onBlur={() => saveCell(r.registrationId, c)}
                      className={`w-24 rounded-lg border bg-rink px-2 py-1 text-white outline-none focus:border-gold ${
                        savedKey === k ? "border-accent" : "border-white/15"
                      }`}
                    />
                    {savingKey === k && <span className="ml-1 text-xs text-ice-100/40">...</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
