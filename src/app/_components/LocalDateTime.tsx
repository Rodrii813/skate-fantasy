"use client";

import { useTimezone } from "./TimezoneProvider";
import { formatInTimeZone, VENUE_TIMEZONE } from "@/lib/timezone";

/**
 * Muestra un instante (ISO string o Date) formateado en la zona horaria
 * elegida por el usuario (o la de su dispositivo por defecto).
 *
 * Antes de montar en el cliente no se conoce esa zona, así que se muestra
 * la hora de la sede (Paraguay) como marcador estable — igual en servidor
 * y cliente, para no generar un warning de hidratación — y se sustituye por
 * la hora ya convertida en cuanto el componente se monta.
 */
export default function LocalDateTime({
  value,
  options,
  className,
}: {
  value: string | Date | null | undefined;
  options: Intl.DateTimeFormatOptions;
  className?: string;
}) {
  const { timeZone, mounted } = useTimezone();

  if (!value) return <span className={className}>—</span>;

  const displayTimeZone = mounted ? timeZone : VENUE_TIMEZONE;

  return <span className={className}>{formatInTimeZone(value, displayTimeZone, options)}</span>;
}
