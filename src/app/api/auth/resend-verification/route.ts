import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

// Cuánto hay que esperar entre dos reenvíos del email de verificación para
// la MISMA cuenta. Sin este límite, alguien podría darle al botón "reenviar"
// en bucle (o un script podría hacerlo) y agotar la cuota gratuita de
// Resend (100 emails/día) en minutos. 2 minutos es tiempo de sobra para que
// llegue el correo antes de pedir otro.
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

// Respuesta SIEMPRE genérica (exista o no la cuenta, esté o no ya
// verificada, esté o no en cooldown), para no revelar por esta vía qué
// emails están registrados — mismo criterio que /api/auth/forgot-password.
function genericResponse() {
  return NextResponse.json({
    ok: true,
    message: "Si existe una cuenta sin verificar con ese email, te hemos enviado un nuevo enlace.",
  });
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

    if (!normalizedEmail) return genericResponse();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        emailVerifications: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    // No existe, o ya verificó su email hace tiempo: no hay nada que
    // reenviar, pero la respuesta es la misma para no filtrar información.
    if (!user || user.emailVerified) return genericResponse();

    const lastToken = user.emailVerifications[0];
    if (lastToken && Date.now() - lastToken.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return genericResponse();
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await prisma.emailVerificationToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    await sendVerificationEmail(user.email, verifyUrl);

    return genericResponse();
  } catch (error) {
    console.error("Error al reenviar el email de verificación:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
