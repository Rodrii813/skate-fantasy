"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresca los datos de la página (router.refresh, sin recargar ni perder el
// estado de los desplegables) cada cierto tiempo mientras la pestaña está a
// la vista. Se usa en las clasificaciones para que los puntos en directo
// aparezcan solos. Con `enabled=false` no hace nada (evento terminado).
// 90 s (antes 45 s): menos carga sobre la base de datos sin que se note.
export default function LiveRefresh({ enabled, intervalMs = 90000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
