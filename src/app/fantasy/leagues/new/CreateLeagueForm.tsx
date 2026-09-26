"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

interface EventOption {
  id: string;
  label: string;
}

interface CompetitionGroup {
  id: string;
  name: string;
  events: EventOption[];
}

export default function CreateLeagueForm({ competitions }: { competitions: CompetitionGroup[] }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).leagues.new;

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allEventIds = competitions.flatMap((c) => c.events.map((e) => e.id));

  const toggle = (eventId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allEventIds));
  const clearAll = () => setSelected(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.errorNoName);
      return;
    }
    if (selected.size === 0) {
      setError(t.errorNoEvents);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, eventIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errorGeneric);
      router.push(`/fantasy/leagues/${data.league.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1.5">{t.nameLabel}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          maxLength={60}
          className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-slate-300">{t.eventsLabel}</label>
          <div className="flex gap-2 text-[11px]">
            <button type="button" onClick={selectAll} className="text-indigo-400 hover:text-indigo-300 underline">
              {t.selectAll}
            </button>
            <button type="button" onClick={clearAll} className="text-slate-500 hover:text-slate-300 underline">
              {t.clearAll}
            </button>
          </div>
        </div>

        {competitions.length === 0 ? (
          <p className="text-xs text-slate-400">{t.noEventsAvailable}</p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {competitions.map((comp) => (
              <div key={comp.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{comp.name}</p>
                <div className="space-y-1.5">
                  {comp.events.map((ev) => (
                    <label
                      key={ev.id}
                      className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(ev.id)}
                        onChange={() => toggle(ev.id)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                      />
                      {ev.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-900/30 text-sm"
      >
        {loading ? t.submitting : t.submit}
      </button>
    </form>
  );
}
