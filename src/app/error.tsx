"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// error.tsx (a diferencia de not-found.tsx) tiene que ser "use client": Next
// lo monta como un error boundary de React alrededor del segmento de ruta
// donde algo ha fallado en tiempo de render, y necesita "reset" (botón de
// reintentar, vuelve a montar el segmento) y poder registrar el error.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale).errors;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <h1 className="font-display text-2xl font-semibold text-white">{t.errorTitle}</h1>
      <p className="mt-3 text-sm text-ice-100/70">{t.errorBody}</p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-rink hover:bg-gold/90"
        >
          {t.tryAgain}
        </button>
        <Link
          href="/"
          className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-ice-100/80 hover:bg-white/5"
        >
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
