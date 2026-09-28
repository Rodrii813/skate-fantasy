import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Límites: por email (que no se pueda inundar la bandeja de una sola
// persona) y por IP (que un script no recorra muchos emails distintos desde
// el mismo sitio). Ambos devuelven la respuesta genérica de siempre, nunca
// un error aparte — así esta ruta sigue sin filtrar nada por su código de
// estado ni por cómo falla.
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 15;
const IP_WINDOW_MS = 60 * 60 * 1000;

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
    const ip = getClientIp(req);
    const ipLimit = checkRateLimit(`forgot-password-ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!ipLimit.allowed) return genericResponse();

    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

    if (!normalizedEmail) return genericResponse();

    const emailLimit = checkRateLimit(`forgot-password-email:${normalizedEmail}`, EMAIL_LIMIT, EMAIL_WINDOW_MS);
    if (!emailLimit.allowed) return genericResponse();

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
