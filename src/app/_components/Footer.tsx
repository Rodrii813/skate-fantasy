import Link from "next/link";
import Image from "next/image";
import logoMark from "./logo-mark.png";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

// Cuentas oficiales de Rollart Fantasy en redes — un único sitio donde
// cambiarlas si algún día cambian de usuario, en vez de tenerlas repetidas
// donde se usen.
const INSTAGRAM_URL = "https://instagram.com/rollartfantasy";
const X_URL = "https://x.com/rollartfantasy";

// Footer con los enlaces legales (Privacidad / Términos) que pide la
// checklist de lanzamiento, más los iconos de Instagram/X para que quien
// visite la web pueda seguir las redes oficiales del proyecto.
export default function Footer() {
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-xs text-ice-100/50 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <Image src={logoMark} alt="" width={20} height={20} className="h-5 w-5 shrink-0 opacity-80" />
          {t.rights(year)} — {t.tagline}
        </p>
        <div className="flex items-center gap-5">
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
          <div className="flex items-center gap-3 border-l border-white/10 pl-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.followInstagram}
              title={t.followInstagram}
              className="text-ice-100/50 transition hover:text-ice-100/90"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
              </svg>
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.followX}
              title={t.followX}
              className="text-ice-100/50 transition hover:text-ice-100/90"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.3 22H1.2l8.1-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4h-2l12.3 16Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
