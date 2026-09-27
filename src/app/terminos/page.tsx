import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

const CONTACT_EMAIL = "support@rollartfantasy.com";

export async function generateMetadata() {
  const locale = getLocale();
  return { title: getDictionary(locale).legal.termsTitle };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-white/10 pt-6">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ice-100/80">{children}</div>
    </section>
  );
}

export default function TerminosPage() {
  const locale = getLocale();
  const { legal } = getDictionary(locale);
  const t = legal.terms;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-accent">{legal.termsTag}</p>
        <h1 className="font-display text-3xl font-semibold text-white">{legal.termsTitle}</h1>
        <p className="mt-3 max-w-2xl text-sm text-ice-100/70">{t.intro}</p>
      </div>

      <Section title={t.s1Title}>
        <p>{t.s1}</p>
      </Section>

      <Section title={t.s2Title}>
        <p>{t.s2}</p>
      </Section>

      <Section title={t.s3Title}>
        <p>{t.s3}</p>
      </Section>

      <Section title={t.s4Title}>
        <p>{t.s4}</p>
      </Section>

      <Section title={t.s5Title}>
        <p>{t.s5}</p>
      </Section>

      <Section title={t.s6Title}>
        <p>{t.s6(CONTACT_EMAIL)}</p>
      </Section>
    </div>
  );
}
