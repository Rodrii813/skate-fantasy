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
    // Sin un ancho explícito, un <select> se dimensiona en Chrome según la
    // opción MÁS LARGA de toda la lista (aquí, las ~419 zonas IANA — cosas
    // como "America/North Dakota/New Salem"), no según el valor
    // seleccionado. Por eso este selector medía ~220px de ancho SIEMPRE,
    // aunque mostrara solo "🌐 Mi zona horaria (Europe/Berlin)" — y era el
    // mayor responsable de que la barra de navegación de escritorio no
    // cupiera en una sola fila (se salía por la derecha, especialmente para
    // administradores, que además tienen el enlace "Admin" de más). Se fija
    // un ancho reducido con `truncate` en el uso por defecto (el de la barra
    // de escritorio y el de /calendario); el uso explícito de
    // /nav-bar.tsx en el menú móvil pasa su propio className con
    // `w-full` y no se ve afectado.
    <select
      value={selection}
      onChange={(e) => setSelection(e.target.value)}
      title={`Zona horaria para mostrar las horas del calendario (actual: ${deviceTimeZone})`}
      className={
        className ||
        "w-40 truncate rounded-lg border border-white/15 bg-transparent px-2 py-1 text-xs text-ice-100/80 hover:text-white"
      }
    >
      <option value={AUTO_TIMEZONE}>🌐 Auto ({deviceTimeZone})</option>
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
