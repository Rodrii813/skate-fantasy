import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { isPushConfigured, pushToAll } from "@/lib/push";
import { prisma } from "@/lib/prisma";

// El admin envía una notificación a todos los dispositivos suscritos.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Las notificaciones no están configuradas (faltan las claves VAPID en Vercel)." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 200) : "";
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  // Solo rutas internas, para no mandar a la gente a webs externas.
  const url = rawUrl.startsWith("/") ? rawUrl : "/";
  if (!title || !text) {
    return NextResponse.json({ error: "Escribe un título y un mensaje." }, { status: 400 });
  }

  const subscribers = await prisma.pushSubscription.count();
  const result = await pushToAll({ title, body: text, url });
  return NextResponse.json({ ok: true, subscribers, ...result });
}

// Nº de dispositivos suscritos (para mostrarlo en el panel).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const subscribers = await prisma.pushSubscription.count();
  return NextResponse.json({ subscribers, configured: isPushConfigured() });
}
