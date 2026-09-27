"use client";

import { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(targetMs: number): TimeLeft | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

// Cuenta atrás llamativa hasta el inicio de la competición (pedida para la
// home). Es un componente cliente porque necesita re-renderizar cada
// segundo — el servidor solo le pasa la fecha objetivo (ISO string, para que
// sobreviva la serialización de props de Server a Client Component) y los
// textos ya traducidos. Si la fecha ya pasó, no se renderiza nada (no tiene
// sentido mostrar una cuenta atrás en negativo).
export default function WorldSkateGamesCountdown({
  targetDate,
  title,
  location,
  prefix,
  labels,
}: {
  targetDate: string;
  title: string;
  location?: string | null;
  prefix: string;
  labels: { days: string; hours: string; minutes: string; seconds: string };
}) {
  const targetMs = new Date(targetDate).getTime();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(targetMs));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!timeLeft) return null;

  const units: { value: number; label: string }[] = [
    { value: timeLeft.days, label: labels.days },
    { value: timeLeft.hours, label: labels.hours },
    { value: timeLeft.minutes, label: labels.minutes },
    { value: timeLeft.seconds, label: labels.seconds },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-rink via-rink to-gold/10 p-5 sm:p-6 shadow-xl shadow-black/40">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold">
            {prefix} · {title}
          </p>
          {location && <p className="mt-0.5 text-xs text-ice-100/50">{location}</p>}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {units.map((u) => (
            <div
              key={u.label}
              className="flex min-w-[52px] flex-col items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:min-w-[64px]"
            >
              <span className="scoreboard-num text-xl font-display font-black text-white sm:text-2xl">
                {String(u.value).padStart(2, "0")}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-ice-100/50">{u.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
