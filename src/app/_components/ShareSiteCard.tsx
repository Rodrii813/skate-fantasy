"use client";

import { useState } from "react";

// Tarjeta para incitar a compartir la web. En móvil (y algunos navegadores
// de escritorio) usa el share sheet nativo (navigator.share); si no está
// disponible, cae en copiar el enlace al portapapeles y lo confirma con un
// mensajito, para que nunca se quede sin hacer nada al pulsar.
export default function ShareSiteCard({
  title,
  body,
  buttonLabel,
  copiedLabel,
  shareTitle,
  shareText,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  copiedLabel: string;
  shareTitle: string;
  shareText: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch {
        // El usuario canceló el share sheet u ocurrió un error — no pasa
        // nada, simplemente no hacemos nada más (no caemos al portapapeles
        // para no confundir con una "copia" que no pidió).
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin permisos de portapapeles (poco común): no hay mucho más que
      // hacer desde aquí sin añadir un input manual solo para este caso.
    }
  };

  return (
    <div className="bg-gradient-to-br from-accent/10 to-white/5 border border-accent/20 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
      <div className="space-y-2">
        <span className="text-xl">📣</span>
        <h3 className="text-lg font-bold text-ice-50">{title}</h3>
        <p className="text-xs text-ice-100/50">{body}</p>
      </div>
      <button
        type="button"
        onClick={handleShare}
        className="w-full text-center bg-accent hover:bg-accent/90 text-rink text-xs font-semibold py-2.5 rounded-xl transition shadow-md shadow-black/30 mt-4"
      >
        {copied ? copiedLabel : buttonLabel}
      </button>
    </div>
  );
}
