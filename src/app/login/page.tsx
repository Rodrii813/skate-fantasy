"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// useSearchParams() exige un límite <Suspense> alrededor (lo usamos para
// leer ?verify=ok/invalid del enlace de /api/auth/verify-email), así que el
// contenido real vive en un componente aparte y esta es solo la envoltura.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getDictionary(locale).auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // "not_verified" muestra un botón de reenviar en vez del error genérico —
  // se distingue del resto de errores porque authorize() en src/lib/auth.ts
  // lanza literalmente el texto "EMAIL_NOT_VERIFIED" para este caso.
  const [notVerified, setNotVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const verifyParam = searchParams.get("verify");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotVerified(false);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error === "EMAIL_NOT_VERIFIED") {
      setNotVerified(true);
      return;
    }
    if (res?.error === "RATE_LIMITED") {
      setError(t.loginRateLimited);
      return;
    }
    if (res?.error) {
      setError(t.loginError);
      return;
    }
    // Antes iba a /events, una lista de eventos antigua (previa al rediseño
    // del Competition Hub) que ya no enlaza nadie desde el menú — de ahí la
    // sensación de "aterrizar en un sitio raro" al iniciar sesión.
    router.push("/");
    router.refresh();
  }

  async function handleResend() {
    setResendState("sending");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResendState("sent");
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl font-semibold text-white">{t.login}</h1>
      {verifyParam === "ok" && (
        <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{t.verifySuccess}</p>
      )}
      {verifyParam === "invalid" && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{t.verifyInvalid}</p>
      )}
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-ice-100/70">{t.email}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-gold"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-ice-100/70">{t.password}</label>
            <a href="/forgot-password" className="text-xs text-gold hover:underline">
              {t.forgotPasswordLink}
            </a>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-gold"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notVerified && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <p>{t.loginNotVerified}</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendState !== "idle"}
              className="mt-1 text-amber-200 underline hover:text-amber-100 disabled:opacity-60"
            >
              {resendState === "sending" ? t.resendSending : resendState === "sent" ? t.resendSent : t.resendVerification}
            </button>
          </div>
        )}
        <button
          disabled={loading}
          className="w-full rounded-full bg-gold px-6 py-2.5 font-semibold text-rink hover:bg-gold/90 disabled:opacity-60"
        >
          {loading ? t.loggingIn : t.login}
        </button>
      </form>
      <p className="mt-6 text-sm text-ice-100/60">
        {t.noAccount}{" "}
        <a href="/register" className="text-gold hover:underline">
          {t.createOne}
        </a>
      </p>
    </div>
  );
}
