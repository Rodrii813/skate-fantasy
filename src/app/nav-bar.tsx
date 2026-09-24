"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-white">
          Skate<span className="text-gold">Fantasy</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ice-100/80">
          <Link href="/events" className="hover:text-white">
            Eventos
          </Link>
          <Link href="/calendario" className="hover:text-white">
            Calendario
          </Link>
          <Link href="/leaderboard" className="hover:text-white">
            Ranking
          </Link>
          <Link href="/fantasy/normas" className="hover:text-white">
            Normas
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-white">
              Admin
            </Link>
          )}
          {session?.user ? (
            <button onClick={() => signOut({ callbackUrl: "/" })} className="hover:text-white">
              Salir ({session.user.name})
            </button>
          ) : (
            <>
              <Link href="/login" className="hover:text-white">
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-gold px-4 py-1.5 font-medium text-rink hover:bg-gold/90"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
