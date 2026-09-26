"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function ForgotPasswordPage() {
  const { locale } = useLocale();
  const t = getDictionary(locale).auth;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.forgotError);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl font-semibold text-white">{t.forgotTitle}</h1>
      <p className="mt-2 text-sm text-ice-100/70">{t.forgotSubtitle}</p>

      {sent ? (
        <div className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {t.forgotSent}
        </div>
      ) : (
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-full bg-gold px-6 py-2.5 font-semibold text-rink hover:bg-gold/90 disabled:opacity-60"
          >
            {loading ? t.forgotSending : t.forgotSubmit}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-ice-100/60">
        <a href="/login" className="text-gold hover:underline">
          {t.backToLogin}
        </a>
      </p>
    </div>
  );
}
