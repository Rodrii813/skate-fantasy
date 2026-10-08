import { prisma } from "@/lib/prisma";
import { isPushConfigured, pushToAll, pushToUsers } from "@/lib/push";
import { decideSegmentNotifications } from "@/lib/segmentNotifications";

// Avisos automáticos del draft: "se ha abierto" y "cierra en menos de 1 hora"
// (este último solo a quien aún no ha fichado a su equipo). Se ejecuta desde
// /api/cron/notify cada pocos minutos; cada aviso se registra en
// NotificationLog para no enviarse dos veces.

async function claim(key: string): Promise<boolean> {
  try {
    await prisma.notificationLog.create({ data: { key } });
    return true;
  } catch {
    return false; // ya existe: ese aviso ya se envió
  }
}

export async function runAutoNotifications(now: Date = new Date()) {
  const summary = { checked: 0, opened: 0, closing: 0, sent: 0 };
  if (!isPushConfigured()) return { ...summary, skipped: "push-not-configured" };

  const events = await prisma.event.findMany({
    where: { isTest: false, status: { not: "FINISHED" } },
    select: {
      id: true,
      name: true,
      rosterLocksAt: true,
      segments: {
        select: { id: true, name: true, order: true, locksAt: true, opensAt: true, manuallyOpened: true },
      },
      slots: { select: { id: true, segmentId: true } },
    },
  });

  type Ev = (typeof events)[number];
  type Seg = Ev["segments"][number];

  for (const ev of events as Ev[]) {
    for (const seg of ev.segments as Seg[]) {
      const segSlots = ev.slots.filter((s: { segmentId: string | null }) => s.segmentId === seg.id);
      summary.checked++;
      const d = decideSegmentNotifications(seg, ev.rosterLocksAt, segSlots.length > 0, now);
      const label = ev.segments.length > 1 ? `${ev.name} · ${seg.name}` : ev.name;

      if (d.opened && (await claim(`open:${seg.id}`))) {
        const r = await pushToAll({
          title: "¡Draft abierto!",
          body: `Ya puedes fichar a tu equipo en ${label}.`,
          url: "/fantasy/draft",
        });
        summary.opened++;
        summary.sent += r.sent;
      }

      if (d.closingSoon && (await claim(`close:${seg.id}`))) {
        const subs = await prisma.pushSubscription.findMany({ select: { userId: true } });
        const subscribed: string[] = Array.from(new Set(subs.map((s: { userId: string }) => s.userId)));
        const slotIds = segSlots.map((s: { id: string }) => s.id);
        const done = await prisma.fantasyPick.findMany({
          where: { slotId: { in: slotIds }, roster: { userId: { in: subscribed } } },
          select: { roster: { select: { userId: true } } },
        });
        const doneIds = new Set(done.map((p: { roster: { userId: string } }) => p.roster.userId));
        const targets = subscribed.filter((id) => !doneIds.has(id));
        const r = await pushToUsers(targets, {
          title: "⏰ Cierra pronto",
          body: `Queda menos de 1 hora para fichar en ${label} y aún no has elegido tu equipo.`,
          url: "/fantasy/draft",
        });
        summary.closing++;
        summary.sent += r.sent;
      }
    }
  }
  return summary;
}
