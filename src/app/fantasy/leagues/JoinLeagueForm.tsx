"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function JoinLeagueForm() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.joinError);
      router.push(`/fantasy/leagues/${data.leagueId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder={t.joinPlaceholder}
        maxLength={12}
        className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm tracking-widest font-mono uppercase focus:outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap"
      >
        {loading ? t.joining : t.joinBtn}
      </button>
      {error && <p className="text-xs text-red-400 sm:ml-2 self-center">{error}</p>}
    </form>
  );
}
