import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

// Respuesta SIEMPRE genérica (exista o no una cuenta con ese email), para no
// revelar por esta vía qué emails están registrados en la web.
function genericResponse() {
  return NextResponse.json({
    ok: true,
    message:
      "Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer la contraseña.",
  });
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

    if (!normalizedEmail) return genericResponse();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return genericResponse();

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    return genericResponse();
  } catch (error) {
    console.error("Error al solicitar recuperación de contraseña:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
