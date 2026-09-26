"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import TimezoneSelector from "./_components/TimezoneSelector";
import LanguageSwitcher from "./_components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// La barra de navegación NO tenía versión móvil: todos los enlaces (+ el
// selector de zona horaria, que es ancho) iban en una única fila con
// "flex" sin permitir salto de línea. En pantallas estrechas eso obligaba a
// toda la página a ser más ancha que la pantalla del teléfono, y por eso el
// contenido se veía comprimido en una columna a la izquierda con un hueco
// vacío a la derecha (el resto de esa fila demasiado ancha). Ahora, por
// debajo del breakpoint "md" se oculta esa fila y aparece un botón de
// hamburguesa que despliega los mismos enlaces en una lista vertical.
//
// El desplegable original era una lista de texto plano sin iconos ni
// jerarquía visual, y aparecía/desaparecía de golpe (sin transición), lo
// que se notaba "barato" comparado con el resto de la web. Aquí se añaden:
// iconos por sección, resaltado del enlace activo (usePathname), separación
// en tarjetas con más aire, y una animación de apertura/cierre con
// max-height + opacity en vez de un simple if/render.

type NavIcon = "trophy" | "calendar" | "fantasy" | "target" | "book" | "shield";

function NavGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (icon) {
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
          <path d="M8 5H5a2 2 0 0 0 2 4M16 5h3a2 2 0 0 1-2 4" />
          <path d="M10 15h4M12 11v4M9 20h6M10 20l.5-2h3l.5 2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
      );
    case "fantasy":
      return (
        <svg {...common}>
          <path d="M12 3.5l1.9 4.4 4.8.4-3.6 3.2 1.1 4.7L12 13.9l-4.2 2.3 1.1-4.7-3.6-3.2 4.8-.4L12 3.5Z" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
          <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5.2c0 4.6-3 8.4-7 9.8-4-1.4-7-5.2-7-9.8V6l7-3Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
}

export default function NavBar() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const t = getDictionary(locale).nav;
  const pathname = usePathname();

  const closeMenu = () => setOpen(false);

  const items: { href: string; label: string; icon: NavIcon }[] = [
    { href: "/competitions", label: t.competitions, icon: "trophy" },
    { href: "/calendario", label: t.calendar, icon: "calendar" },
    { href: "/fantasy", label: t.fantasy, icon: "fantasy" },
    { href: "/predictions", label: t.predictions, icon: "target" },
    { href: "/fantasy/normas", label: t.rules, icon: "book" },
    ...(isAdmin ? [{ href: "/admin", label: t.admin, icon: "shield" as NavIcon }] : []),
  ];

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  const navLinks = (
    <>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="hover:text-white" onClick={closeMenu}>
          {item.label}
        </Link>
      ))}
    </>
  );

  // Versión con icono + resaltado del enlace activo, usada solo en el
  // desplegable móvil (en escritorio el espacio es más ajustado y el texto
  // plano ya se lee bien en una fila horizontal).
  const mobileNavLinks = (
    <>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMenu}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-gold/15 text-gold"
                : "text-ice-100/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <NavGlyph icon={item.icon} className={active ? "text-gold" : "text-ice-100/50"} />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  const authLinks = session?.user ? (
    <button
      onClick={() => {
        closeMenu();
        signOut({ callbackUrl: "/" });
      }}
      className="hover:text-white"
    >
      {t.logout(session.user.name || "")}
    </button>
  ) : (
    <>
      <Link href="/login" className="hover:text-white" onClick={closeMenu}>
        {t.login}
      </Link>
      <Link
        href="/register"
        onClick={closeMenu}
        className="rounded-full bg-gold px-4 py-1.5 font-medium text-rink hover:bg-gold/90"
      >
        {t.register}
      </Link>
    </>
  );

  const mobileAuthLinks = session?.user ? (
    <button
      onClick={() => {
        closeMenu();
        signOut({ callbackUrl: "/" });
      }}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ice-100/80 hover:bg-white/5 hover:text-white"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ice-100/50">
        <path d="M9 21H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3H9" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
      {t.logout(session.user.name || "")}
    </button>
  ) : (
    <>
      <Link
        href="/login"
        onClick={closeMenu}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ice-100/80 hover:bg-white/5 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ice-100/50">
          <path d="M15 3h3.5A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5H15" />
          <path d="M8 7l-5 5 5 5M3 12h12" />
        </svg>
        {t.login}
      </Link>
      <Link
        href="/register"
        onClick={closeMenu}
        className="mt-1 rounded-xl bg-gold px-3 py-2.5 text-center text-sm font-semibold text-rink hover:bg-gold/90"
      >
        {t.register}
      </Link>
    </>
  );

  return (
    <header className="border-b border-white/10 relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 gap-4">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-white shrink-0"
          onClick={closeMenu}
        >
          Rollart<span className="text-gold">Fantasy</span>
        </Link>

        {/* Navegación de escritorio: fila horizontal completa, oculta en móvil.
            Se agrupa en 3 bloques (links / idioma+zona horaria / sesión) con
            separadores, en vez de un único "gap-6" plano, para que no se vea
            todo apelotonado cuando hay muchos enlaces (Competiciones, Calendario,
            Fantasy, Predicción, Normas, Admin...). */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-ice-100/80">
          <div className="flex items-center gap-6">{navLinks}</div>
          <div className="flex items-center gap-3 pl-6 border-l border-white/10">
            <LanguageSwitcher />
            <TimezoneSelector />
          </div>
          <div className="flex items-center gap-4 pl-4 border-l border-white/10">{authLinks}</div>
        </nav>

        {/* En móvil: selector de idioma siempre visible junto al botón de
            hamburguesa, para no obligar a abrir el menú solo para cambiar de
            idioma. El botón cambia de fondo cuando el menú está abierto para
            que quede claro que es un toggle, no solo un icono suelto. */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
            className={`-mr-2 rounded-lg p-2 transition-colors ${
              open ? "bg-white/10 text-white" : "text-ice-100/80 hover:text-white"
            }`}
          >
            {open ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menú desplegable en móvil: se anima con max-height + opacity (en vez
          de aparecer/desaparecer de golpe) y usa tarjetas con icono en vez de
          una lista de texto plano, para que se sienta más "app" que la
          versión anterior. Se mantiene siempre montado (no solo cuando
          `open`) para que la transición de cierre también se vea. */}
      <div
        className={`md:hidden overflow-hidden border-t border-white/10 bg-rink transition-[max-height,opacity] duration-300 ease-in-out ${
          open ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-4 text-sm">
          {mobileNavLinks}
          <div className="mt-2 pt-3 border-t border-white/10">
            <TimezoneSelector className="w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-ice-100/80" />
          </div>
          <div className="mt-1 pt-2 flex flex-col">{mobileAuthLinks}</div>
        </nav>
      </div>
    </header>
  );
}
