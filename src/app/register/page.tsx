"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function RegisterPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).auth;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/events");
    router.refresh();
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
