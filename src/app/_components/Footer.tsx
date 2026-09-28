import Link from "next/link";
import Image from "next/image";
import logoMark from "./logo-mark.png";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

// Footer con los enlaces legales (Privacidad / Términos) que pide la
// checklist de lanzamiento — hasta ahora no existía ningún footer en la web.
export default function Footer() {
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-ice-100/50 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <Image src={logoMark} alt="" width={20} height={20} className="h-5 w-5 shrink-0 opacity-80" />
          {t.rights(year)} — {t.tagline}
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/contacto" className="hover:text-ice-100/80">
            {dict.contact.navLabel}
          </Link>
          <Link href="/privacidad" className="hover:text-ice-100/80">
            {t.privacy}
          </Link>
          <Link href="/terminos" className="hover:text-ice-100/80">
            {t.terms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
