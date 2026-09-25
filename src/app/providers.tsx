"use client";

import { SessionProvider } from "next-auth/react";
import { TimezoneProvider } from "./_components/TimezoneProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TimezoneProvider>{children}</TimezoneProvider>
    </SessionProvider>
  );
}
