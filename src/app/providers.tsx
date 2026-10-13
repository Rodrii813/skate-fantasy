"use client";

import { SessionProvider } from "next-auth/react";
import { TimezoneProvider } from "./_components/TimezoneProvider";

// Sin refetchOnWindowFocus: cada vez que el usuario volvía a la pestaña se
// llamaba a /api/auth/session (1,3 mil llamadas en 12 h en Vercel). La sesión
// sigue refrescándose al navegar y al cargar la página.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <TimezoneProvider>{children}</TimezoneProvider>
    </SessionProvider>
  );
}
