import Link from "next/link";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function generateMetadata() {
  const locale = getLocale();
  return { title: getDictionary(locale).normas.pageTitle };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-white/10 pt-6">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ice-100/80">{children}</div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{children}</div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function NormasPage() {
  const locale = getLocale();
  const t = getDictionary(locale).normas;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-accent">{t.tag}</p>
        <h1 className="font-display text-3xl font-semibold text-white">{t.title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-ice-100/70">{t.intro}</p>
      </div>

      <Section title={t.s1.title}>
        <p>{t.s1.p1}</p>
        <p>{t.s1.p2}</p>
        <p className="text-xs text-ice-100/50">{t.s1.note}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s1.shortCardTitle}</p>
            <List items={t.s1.shortList} />
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s1.longCardTitle}</p>
            <List items={t.s1.longList} />
          </Card>
        </div>
        <p>{t.s1.p3}</p>
        <p className="text-xs text-ice-100/50">{t.s1.inlineNote}</p>
      </Section>

      <Section title={t.s2.title}>
        <p>{t.s2.p1}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s2.styleDanceTitle}</p>
            <List items={t.s2.styleDanceList} />
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s2.freedanceTitle}</p>
            <List items={t.s2.freedanceList} />
          </Card>
        </div>
        <p>{t.s2.p2}</p>
      </Section>

      <Section title={t.s3.title}>
        <p>{t.s3.p1}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s3.shortTitle}</p>
            <List items={t.s3.shortList} />
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s3.freeTitle}</p>
            <List items={t.s3.freeList} />
          </Card>
        </div>
        <p>{t.s3.p2}</p>
      </Section>

      <Section title={t.s4.title}>
        <p>{t.s4.p1}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s4.styleDanceTitle}</p>
            <List items={t.s4.styleDanceList} />
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s4.freeDanceTitle}</p>
            <List items={t.s4.freeDanceList} />
          </Card>
        </div>
        <p>{t.s4.p2}</p>
      </Section>

      <Section title={t.s5.title}>
        <p>{t.s5.p1}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s5.quartetsTitle}</p>
            <List items={t.s5.quartetsList} />
            <p className="mt-2 text-xs text-ice-100/60">{t.s5.quartetsNote}</p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s5.groupsTitle}</p>
            <p className="text-ice-100/75">{t.s5.groupsBody}</p>
            <List items={t.s5.groupsList} />
          </Card>
        </div>
      </Section>

      <Section title={t.s6.title}>
        <p>{t.s6.p1}</p>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t.s6.cardTitle}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 list-inside list-disc text-ice-100/75">
            {t.s6.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <p>{t.s6.p2}</p>
      </Section>

      <Section title={t.s7.title}>
        <p>{t.s7.p1}</p>
        <div className="space-y-2">
          <Card>
            <p className="font-semibold text-white">{t.s7.techCardTitle}</p>
            <List items={t.s7.techList} />
          </Card>
          <Card>
            <p className="font-semibold text-white">{t.s7.compCardTitle}</p>
            <List items={t.s7.compList} />
          </Card>
        </div>
        <p className="text-xs text-ice-100/50">{t.s7.note}</p>
      </Section>

      <Section title={t.s8.title}>
        <p>{t.s8.p1}</p>
        <p>{t.s8.p2}</p>
      </Section>

      <Section title={t.s9.title}>
        <p>{t.s9.p1}</p>
        <Card>
          <ul className="list-inside list-disc space-y-1 text-ice-100/75">
            {t.s9.items.map((item) => (
              <li key={item.bold}>
                <strong className="text-white">{item.bold}</strong> {item.rest}
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <div className="border-t border-white/10 pt-6">
        <Link
          href="/fantasy"
          className="inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-rink hover:bg-gold/90"
        >
          {t.backLink}
        </Link>
      </div>
    </div>
  );
}
