"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

// Formulario para cambiar el nickname público (el que se ve en rankings,
// ligas, etc. — ver User.name en el schema). Tras guardarlo con éxito, se
// llama a update({ name }) de next-auth para refrescar el JWT/sesión al
// vuelo (ver el callback jwt en src/lib/auth.ts): sin eso, el nuevo nombre
// no aparecería en la barra de navegación ni en las ligas hasta volver a
// iniciar sesión.
export default function NicknameForm({ currentName }: { currentName: string }) {
  const { update } = useSession();
  const { locale } = useLocale();
  const t = getDictionary(locale).profile;

  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const trimmed = name.trim();
  const unchanged = trimmed === currentName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || unchanged) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/account/nickname", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.error);

      await update({ name: data.name });
      setName(data.name);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">{t.nicknameTitle}</h2>
        <p className="text-[11px] text-slate-400 mt-1">{t.nicknameHint}</p>
      </div>

      <div className="space-y-1 text-xs">
        <label className="text-slate-400">{t.nicknameLabel}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSuccess(false);
            setError(null);
          }}
          maxLength={40}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
          required
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-emerald-400">{t.success}</p>}

      <button
        type="submit"
        disabled={saving || !trimmed || unchanged}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
      >
        {saving ? t.saving : t.save}
      </button>
    </form>
  );
}
