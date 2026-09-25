"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { detectDeviceTimeZone } from "@/lib/timezone";

const STORAGE_KEY = "skate-fantasy:timezone";
// Sentinel que significa "sigue la zona horaria del dispositivo", en vez de
// congelar la zona detectada en el momento en que el usuario la guardó.
const AUTO = "auto";

interface TimezoneContextValue {
  // Zona horaria efectiva a usar para formatear fechas (nunca "auto": ya
  // resuelta a una zona IANA concreta).
  timeZone: string;
  // Lo que el selector debe mostrar como elegido: "auto" o una zona concreta.
  selection: string;
  setSelection: (value: string) => void;
  // Antes del primer render en el cliente no se puede saber ni la zona del
  // dispositivo ni lo guardado en localStorage; los componentes que
  // formatean fechas deben esperar a `mounted` para no desincronizar el
  // HTML del servidor con el del cliente.
  mounted: boolean;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelectionState] = useState<string>(AUTO);
  const [deviceTimeZone, setDeviceTimeZone] = useState<string>("UTC");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDeviceTimeZone(detectDeviceTimeZone());
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectionState(stored);
    } catch {
      // localStorage no disponible (modo privado, etc.): se queda en "auto".
    }
    setMounted(true);
  }, []);

  const setSelection = (value: string) => {
    setSelectionState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // no pasa nada si no se puede persistir, solo dura la sesión actual
    }
  };

  const timeZone = selection === AUTO ? deviceTimeZone : selection;

  const value = useMemo(
    () => ({ timeZone, selection, setSelection, mounted }),
    [timeZone, selection, mounted]
  );

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error("useTimezone debe usarse dentro de <TimezoneProvider>");
  return ctx;
}

export { AUTO as AUTO_TIMEZONE };
