"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function RegisterPage() {
  const { locale } = useLocale();
  const t = getDictionary(locale).auth;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Antes, al registrarse, se iniciaba sesión automáticamente y se
  // redirigía a /events. Ahora el login está bloqueado hasta confirmar el
  // email (ver src/lib/auth.ts), así que en vez de eso se muestra este aviso
  // con la opción de reenviar el correo si no llega.
  const [registered, setRegistered] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  // Antes esto era solo un aviso pasivo ("al crear una cuenta aceptas...")
  // debajo del botón. Una casilla que el usuario tiene que marcar a
  // propósito es la forma correcta de que cuente como aceptación real de
  // los Términos/Privacidad (y no solo un texto que nadie lee).
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError(t.mustAcceptTerms);
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? t.registerError);
      setLoading(false);
      return;
    }

    setLoading(false);
    setRegistered(true);
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

  if (registered) {
    return (
      <div className="mx-auto max-w-sm py-10">
        <h1 className="font-display text-3xl font-semibold text-white">{t.registerCheckEmailTitle}</h1>
        <p className="mt-4 text-sm text-ice-100/80">{t.registerCheckEmailBody(email)}</p>
        <button
          onClick={handleResend}
          disabled={resendState !== "idle"}
          className="mt-6 text-sm text-gold hover:underline disabled:opacity-60"
        >
          {resendState === "sending" ? t.resendSending : resendState === "sent" ? t.resendSent : t.resendVerification}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl font-semibold text-white">{t.register}</h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-ice-100/70">{t.name}</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-gold"
          />
          <p className="mt-1 text-xs text-ice-100/50">{t.nameHint}</p>
        </div>
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
          <label className="text-sm text-ice-100/70">{t.passwordHint}</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-gold"
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-ice-100/70">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => {
              setAcceptedTerms(e.target.checked);
              if (e.target.checked) setError(null);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/25 bg-white/5 accent-gold"
          />
          <span>
            {t.agreePrefix}{" "}
            <Link href="/terminos" className="text-gold hover:underline">
              {t.registerAgreementTerms}
            </Link>{" "}
            {t.agreeMiddle}{" "}
            <Link href="/privacidad" className="text-gold hover:underline">
              {t.registerAgreementPrivacy}
            </Link>
            .
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-full bg-gold px-6 py-2.5 font-semibold text-rink hover:bg-gold/90 disabled:opacity-60"
        >
          {loading ? t.creating : t.register}
        </button>
      </form>
    </div>
  );
}
