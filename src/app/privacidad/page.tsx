import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

const CONTACT_EMAIL = "rodrigomre08@gmail.com";

export async function generateMetadata() {
  const locale = getLocale();
  return { title: getDictionary(locale).legal.privacyTitle };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-white/10 pt-6">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ice-100/80">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1.5 text-ice-100/75">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacidadPage() {
  const locale = getLocale();
  const { legal } = getDictionary(locale);
  const t = legal.privacy;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-accent">{legal.privacyTag}</p>
        <h1 className="font-display text-3xl font-semibold text-white">{legal.privacyTitle}</h1>
        <p className="mt-3 max-w-2xl text-sm text-ice-100/70">{legal.privacyIntro}</p>
      </div>

      <Section title={t.s1Title}>
        <List items={t.s1} />
      </Section>

      <Section title={t.s2Title}>
        <List items={t.s2} />
      </Section>

      <Section title={t.s3Title}>
        <List items={t.s3} />
      </Section>

      <Section title={t.s4Title}>
        <p>{t.s4}</p>
      </Section>

      <Section title={t.s5Title}>
        <p>{t.s5(CONTACT_EMAIL)}</p>
      </Section>
    </div>
  );
}
