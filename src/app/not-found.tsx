import Link from "next/link";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

// Next.js muestra esto en vez de su 404 genérica en blanco y negro cuando
// no existe ninguna ruta que encaje (ver notFound() y rutas inexistentes).
export default function NotFound() {
  const t = getDictionary(getLocale()).errors;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <p className="font-display text-6xl font-semibold text-gold">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-white">{t.notFoundTitle}</h1>
      <p className="mt-3 text-sm text-ice-100/70">{t.notFoundBody}</p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-rink hover:bg-gold/90"
      >
        {t.backHome}
      </Link>
    </div>
  );
}
