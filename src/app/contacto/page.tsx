"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

type Reason = "bug" | "help" | "suggestion" | "other";

export default function ContactoPage() {
  const { locale } = useLocale();
  const t = getDictionary(locale).contact;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<Reason>("bug");
  const [message, setMessage] = useState("");
  // Campo honeypot: invisible para una persona (ver className sr-only más
  // abajo), pero un bot de formularios que rellena todos los inputs sí lo
  // toca — si llega relleno, el servidor lo descarta en silencio.
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reason, message, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.error);
      setSent(true);
    } catch (err: any) {
      setError(err.message || t.error);
    } finally {
      setLoading(false);
    }
  }

  function handleSendAnother() {
    setSent(false);
    setName("");
    setEmail("");
    setReason("bug");
    setMessage("");
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-white">{t.title}</h1>
        <p className="mt-4 text-sm text-ice-100/80">{t.success}</p>
        <button
          onClick={handleSendAnother}
          className="mt-6 text-sm text-gold hover:underline"
        >
          {t.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="font-display text-3xl font-semibold text-white">{t.title}</h1>
      <p className="mt-3 text-sm text-ice-100/70">{t.intro}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {/* Honeypot: oculto visualmente (no display:none, para que los bots
            más simples que solo miran "type" lo sigan rellenando) y fuera
            del tab order. */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          aria-hidden="true"
        />

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
          <label className="text-sm text-ice-100/70">{t.reason}</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as Reason)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-gold"
          >
            <option value="bug" className="bg-rink">{t.reasonBug}</option>
            <option value="help" className="bg-rink">{t.reasonHelp}</option>
            <option value="suggestion" className="bg-rink">{t.reasonSuggestion}</option>
            <option value="other" className="bg-rink">{t.reasonOther}</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-ice-100/70">{t.message}</label>
          <textarea
            required
            rows={5}
            maxLength={4000}
            placeholder={t.messagePlaceholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-gold"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-full bg-gold px-6 py-2.5 font-semibold text-rink hover:bg-gold/90 disabled:opacity-60"
        >
          {loading ? t.sending : t.submit}
        </button>
      </form>
    </div>
  );
}
