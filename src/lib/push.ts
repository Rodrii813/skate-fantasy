import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Envío de notificaciones push (PWA). Necesita 3 variables de entorno:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Sin ellas, las notificaciones quedan desactivadas y nada falla.

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contacto@rollartfantasy.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendToSubscriptions(subs: Sub[], payload: PushPayload) {
  if (!configure() || subs.length === 0) return { sent: 0, removed: 0 };
  const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/" });
  let sent = 0;
  const dead: string[] = [];
  // En tandas pequeñas para no saturar la función serverless.
  for (let i = 0; i < subs.length; i += 25) {
    const batch = subs.slice(i, i + 25);
    await Promise.all(
      batch.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.id);
        }
      })
    );
  }
  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }
  return { sent, removed: dead.length };
}

/** Notificación a todos los dispositivos suscritos. */
export async function pushToAll(payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return sendToSubscriptions(subs, payload);
}

/** Notificación solo a los usuarios indicados. */
export async function pushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return sendToSubscriptions(subs, payload);
}

/** Usuarios con roster o predicción en un evento (a quién avisar de sus resultados). */
export async function pushToEventParticipants(eventId: string, payload: PushPayload) {
  const [rosters, predictions] = await Promise.all([
    prisma.fantasyRoster.findMany({ where: { eventId }, select: { userId: true } }),
    prisma.prediction.findMany({ where: { eventId }, select: { userId: true } }),
  ]);
  const ids = Array.from(
    new Set([...rosters.map((r: { userId: string }) => r.userId), ...predictions.map((p: { userId: string }) => p.userId)])
  );
  return pushToUsers(ids, payload);
}
