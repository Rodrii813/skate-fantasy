import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

// Ajustes globales del sitio (de momento, la cuenta atrás de la home — ver
// SiteSettings en el schema). Fila única con id fijo "singleton": GET la
// crea con valores por defecto si todavía no existe (primera vez que se
// visita el panel), PUT hace upsert sobre esa misma fila.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const settings = await prisma.siteSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      countdownEnabled,
      countdownTitle,
      countdownLocation,
      countdownTargetDate,
      announcementEnabled,
      announcementText,
    } = body;

    if (countdownEnabled && !countdownTargetDate) {
      return NextResponse.json(
        { error: "Falta la fecha objetivo para activar la cuenta atrás." },
        { status: 400 }
      );
    }
    if (announcementEnabled && !announcementText?.trim()) {
      return NextResponse.json(
        { error: "Falta el texto del anuncio para activarlo." },
        { status: 400 }
      );
    }

    const data = {
      countdownEnabled: !!countdownEnabled,
      countdownTitle: countdownTitle?.trim() || null,
      countdownLocation: countdownLocation?.trim() || null,
      countdownTargetDate: countdownTargetDate ? new Date(countdownTargetDate) : null,
      announcementEnabled: !!announcementEnabled,
      announcementText: announcementText?.trim() || null,
    };

    const settings = await prisma.siteSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    return NextResponse.json({ ok: true, settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
