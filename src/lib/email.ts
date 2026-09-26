import { Resend } from "resend";

// Cliente de Resend: null si no hay API key configurada (p.ej. en local sin
// .env completo) — en ese caso no rompemos el flujo de recuperación de
// contraseña, solo dejamos el enlace en la consola del servidor para poder
// probarlo igualmente. En producción (Vercel) SIEMPRE debe estar
// configurada la variable RESEND_API_KEY para que el email se envíe de
// verdad.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// "onboarding@resend.dev" es el dominio compartido de pruebas de Resend:
// funciona sin verificar un dominio propio, así que sirve como valor por
// defecto para arrancar sin configuración extra. Se puede sustituir por un
// remitente con dominio propio verificado vía RESEND_FROM_EMAIL.
const FROM = process.env.RESEND_FROM_EMAIL || "Rollart Fantasy <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY no configurada — no se ha enviado el email de recuperación. Enlace de prueba:",
      resetUrl
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Recupera tu contraseña — Rollart Fantasy",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 4px;">Recupera tu contraseña</h2>
        <p>Alguien (esperamos que hayas sido tú) ha pedido restablecer la contraseña de tu cuenta en Rollart Fantasy.</p>
        <p style="margin: 24px 0;">
          <a
            href="${resetUrl}"
            style="display:inline-block;background:#facc15;color:#0f172a;padding:10px 22px;border-radius:9999px;text-decoration:none;font-weight:600;"
          >
            Elegir nueva contraseña
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">
          Este enlace caduca en 1 hora. Si no has sido tú, puedes ignorar este correo sin problema — tu contraseña no cambiará.
        </p>
      </div>
    `,
  });
}
