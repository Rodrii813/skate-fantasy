"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import TimezoneSelector from "./_components/TimezoneSelector";

// La barra de navegación NO tenía versión móvil: todos los enlaces (+ el
// selector de zona horaria, que es ancho) iban en una única fila con
// "flex" sin permitir salto de línea. En pantallas estrechas eso obligaba a
// toda la página a ser más ancha que la pantalla del teléfono, y por eso el
// contenido se veía comprimido en una columna a la izquierda con un hueco
// vacío a la derecha (el resto de esa fila demasiado ancha). Ahora, por
// debajo del breakpoint "md" se oculta esa fila y aparece un botón de
// hamburguesa que despliega los mismos enlaces en una lista vertical.
export default function NavBar() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  const navLinks = (
    <>
      <Link href="/events" className="hover:text-white" onClick={closeMenu}>
        Eventos
      </Link>
      <Link href="/calendario" className="hover:text-white" onClick={closeMenu}>
        Calendario
      </Link>
      <Link href="/resultados" className="hover:text-white" onClick={closeMenu}>
        Resultados
      </Link>
      <Link href="/leaderboard" className="hover:text-white" onClick={closeMenu}>
        Ranking
      </Link>
      <Link href="/fantasy/normas" className="hover:text-white" onClick={closeMenu}>
        Normas
      </Link>
      {isAdmin && (
        <Link href="/admin" className="hover:text-white" onClick={closeMenu}>
          Admin
        </Link>
      )}
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
      Salir ({session.user.name})
    </button>
  ) : (
    <>
      <Link href="/login" className="hover:text-white" onClick={closeMenu}>
        Entrar
      </Link>
      <Link
        href="/register"
        onClick={closeMenu}
        className="rounded-full bg-gold px-4 py-1.5 font-medium text-rink hover:bg-gold/90"
      >
        Crear cuenta
      </Link>
    </>
  );

  return (
    <header className="border-b border-white/10 relative">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-white"
          onClick={closeMenu}
        >
          Skate<span className="text-gold">Fantasy</span>
        </Link>

        {/* Navegación de escritorio: fila horizontal completa, oculta en móvil */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-ice-100/80">
          {navLinks}
          <TimezoneSelector />
          {authLinks}
        </nav>

        {/* Botón de hamburguesa: solo visible por debajo de "md" */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="md:hidden -mr-2 p-2 text-ice-100/80 hover:text-white"
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

      {/* Menú desplegable en móvil: lista vertical con fondo sólido para
          que no se mezcle visualmente con el contenido de debajo */}
      {open && (
        <nav className="md:hidden flex flex-col gap-3 border-t border-white/10 bg-rink px-4 py-4 text-sm text-ice-100/80">
          {navLinks}
          <div className="pt-1">
            <TimezoneSelector className="w-full rounded-lg border border-white/15 bg-transparent px-2 py-2 text-xs text-ice-100/80" />
          </div>
          <div className="pt-2 mt-1 border-t border-white/10 flex flex-col gap-3">{authLinks}</div>
        </nav>
      )}
    </header>
  );
}
