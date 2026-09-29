import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";

// Aviso para eventos marcados como "de prueba" (Event.isTest) — pensado para
// el evento que se crea antes de tener órdenes de salida reales, solo para
// que la gente practique la interfaz de Fantasy/Predicciones sin confundirlo
// con una prueba real. Se usa desde Server Components, que ya tienen el
// locale a mano vía getLocale().
export default function TestEventBanner({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).testEvent;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <span className="text-xl leading-none">🧪</span>
      <div>
        <p className="text-sm font-bold text-amber-300">{t.bannerTitle}</p>
        <p className="text-xs text-amber-200/80 mt-0.5">{t.bannerBody}</p>
      </div>
    </div>
  );
}
