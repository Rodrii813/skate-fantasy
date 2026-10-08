import { NextResponse } from "next/server";
import { runAutoNotifications } from "@/lib/autoNotify";

export const dynamic = "force-dynamic";

// Lo llama un planificador externo cada pocos minutos (GitHub Actions o
// similar) con la cabecera "Authorization: Bearer <CRON_SECRET>".
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await runAutoNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Error en avisos automáticos:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
