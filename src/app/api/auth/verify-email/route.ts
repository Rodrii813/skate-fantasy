import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET porque el enlace viene directo del email (el usuario hace clic, no
// envía un formulario) — no hace falta sesión ni CSRF: el propio token de un
// solo uso ya es la prueba de que quien lo abre tiene acceso al correo.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?verify=invalid`);
  }

  const verificationToken = await prisma.emailVerificationToken.findUnique({ where: { token } });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    return NextResponse.redirect(`${baseUrl}/login?verify=invalid`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.redirect(`${baseUrl}/login?verify=ok`);
}
