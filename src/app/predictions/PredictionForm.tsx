"use client";

import { isSmallField } from "@/lib/fantasyValidation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SkaterSearchSelect, { type SkaterSearchOption } from "@/app/_components/SkaterSearchSelect";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { getDictionary } from "@/lib/i18n/dictionary";

interface Skater {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
}

interface PredictionFormProps {
  eventId: string;
  isLocked: boolean;
  skaters: Skater[];
  initialPrediction?: {
    rank1SkaterId: string;
    rank2SkaterId: string;
    rank3SkaterId: string;
    rank4SkaterId?: string | null;
    rank5SkaterId?: string | null;
  } | null;
}

export default function PredictionForm({
  eventId,
  isLocked,
  skaters,
  initialPrediction,
}: PredictionFormProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const dict = getDictionary(locale);
  const t = dict.predictions.form;

  const [rank1, setRank1] = useState(initialPrediction?.rank1SkaterId || "");
  const [rank2, setRank2] = useState(initialPrediction?.rank2SkaterId || "");
  const [rank3, setRank3] = useState(initialPrediction?.rank3SkaterId || "");
  const [rank4, setRank4] = useState(initialPrediction?.rank4SkaterId || "");
  const [rank5, setRank5] = useState(initialPrediction?.rank5SkaterId || "");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Con pocas patinadoras inscritas solo se predice el podio (top 3).
  const podiumOnly = isSmallField(skaters.length);
  const selectedList = [rank1, rank2, rank3, ...(podiumOnly ? [] : [rank4, rank5])];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          rank1SkaterId: rank1,
          rank2SkaterId: rank2,
          rank3SkaterId: rank3,
          rank4SkaterId: podiumOnly ? null : rank4 || null,
          rank5SkaterId: podiumOnly ? null : rank5 || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.error);
      }

      setMessage({ text: t.saved, error: false });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setLoading(false);
    }
  };

  const renderSelect = (
    label: string,
    badge: string,
    value: string,
    onChange: (val: string) => void,
    required: boolean = true
  ) => {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold font-mono px-3 py-1 bg-slate-800 rounded-lg text-slate-200 border border-slate-700">
            {badge}
          </span>
          <div>
            <span className="font-semibold text-slate-200 text-sm">{label}</span>
            {required && <span className="text-amber-400 text-xs ml-1">*</span>}
          </div>
        </div>

        <div className="w-full sm:w-72">
          <SkaterSearchSelect
            value={value}
            onChange={onChange}
            groups={[
              {
                label: null,
                options: skaters.map(
                  (s): SkaterSearchOption => ({
                    id: s.id,
                    firstName: s.firstName,
                    lastName: s.lastName,
                    country: s.country,
                    disabled: selectedList.includes(s.id) && s.id !== value,
                    disabledLabel: t.alreadyChosen,
                  })
                ),
              },
            ]}
            placeholder={t.chooseSkater}
            searchPlaceholder={dict.common.searchSkaters}
            noResultsLabel={dict.common.noSkatersFound}
            disabled={isLocked || loading}
            ringColorClass="focus:ring-blue-500"
          />
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            message.error
              ? "bg-red-500/15 border border-red-500/30 text-red-400"
              : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {renderSelect(t.gold, "🥇 1º", rank1, setRank1, true)}
        {renderSelect(t.silver, "🥈 2º", rank2, setRank2, true)}
        {renderSelect(t.bronze, "🥉 3º", rank3, setRank3, true)}
        {!podiumOnly && renderSelect(t.fourth, "4º", rank4, setRank4, false)}
        {!podiumOnly && renderSelect(t.fifth, "5º", rank5, setRank5, false)}
      </div>

      {!isLocked && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-900/30 text-sm"
          >
            {loading ? t.saving : initialPrediction ? t.update : t.save}
          </button>
        </div>
      )}
    </form>
  );
}