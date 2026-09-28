import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

// Límite generoso pensado para frenar un script que pruebe nicknames al
// vuelo para ver cuáles están libres, no para molestar a alguien que
// simplemente se equivoca una o dos veces al escribir el suyo.
const NICKNAME_CHANGE_LIMIT = 10;
const NICKNAME_CHANGE_WINDOW_MS = 60 * 60 * 1000;

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(`nickname-change:${userId}:${ip}`, NICKNAME_CHANGE_LIMIT, NICKNAME_CHANGE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse(limit, "Demasiados cambios seguidos. Prueba de nuevo en un rato.");
  }

  const body = await req.json().catch(() => ({}));
  const trimmedName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!trimmedName) {
    return NextResponse.json({ error: "El nickname no puede estar vacío." }, { status: 400 });
  }
  if (trimmedName.length > 40) {
    return NextResponse.json({ error: "El nickname es demasiado largo (máx. 40 caracteres)." }, { status: 400 });
  }

  // Mismo criterio de unicidad que en el registro (ver /api/register): el
  // nickname se ve en todos los rankings, así que no puede repetirse con el
  // de otra persona. Se excluye la propia cuenta para permitir "guardar" sin
  // cambiar nada (o cambiar solo mayúsculas/espacios) sin que choque consigo
  // misma.
  const existing = await prisma.user.findFirst({
    where: { name: trimmedName, NOT: { id: userId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Ese nickname ya está en uso, elige otro." }, { status: 409 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: trimmedName },
      select: { name: true },
    });
    return NextResponse.json({ ok: true, name: updated.name });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Ese nickname ya está en uso, elige otro." }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || "No se ha podido actualizar el nickname." }, { status: 500 });
  }
}
