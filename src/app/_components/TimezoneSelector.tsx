"use client";

import { useMemo } from "react";
import { useTimezone, AUTO_TIMEZONE } from "./TimezoneProvider";
import { COMMON_TIMEZONES, detectDeviceTimeZone, listSupportedTimeZones } from "@/lib/timezone";

export default function TimezoneSelector({ className }: { className?: string }) {
  const { selection, setSelection, mounted } = useTimezone();

  // Intl.supportedValuesOf("timeZone") da la lista completa de IANA cuando
  // el runtime la soporta (navegadores modernos); si no, se usa un listado
  // curado con las zonas más relevantes para esta competición.
  const options = useMemo(() => {
    const full = listSupportedTimeZones();
    return full.length > 0 ? full : COMMON_TIMEZONES;
  }, []);

  if (!mounted) return null;

  const deviceTimeZone = detectDeviceTimeZone();

  return (
    <select
      value={selection}
      onChange={(e) => setSelection(e.target.value)}
      title="Zona horaria para mostrar las horas del calendario"
      className={
        className ||
        "rounded-lg border border-white/15 bg-transparent px-2 py-1 text-xs text-ice-100/80 hover:text-white"
      }
    >
      <option value={AUTO_TIMEZONE}>🌐 Mi zona horaria ({deviceTimeZone})</option>
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
