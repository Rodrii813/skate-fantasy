import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// body: { registrationId, segmentId, elementCategoryId, value, note? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un admin puede cargar resultados." }, { status: 403 });
  }

  const { registrationId, segmentId, elementCategoryId, value, note } = await req.json();
  if (!registrationId || !segmentId || !elementCategoryId || typeof value !== "number") {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const score = await prisma.elementScore.upsert({
    where: {
      registrationId_segmentId_elementCategoryId: {
        registrationId,
        segmentId,
        elementCategoryId,
      },
    },
    create: { registrationId, segmentId, elementCategoryId, value, note },
    update: { value, note },
  });

  return NextResponse.json(score);
}
