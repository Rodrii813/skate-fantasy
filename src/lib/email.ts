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

// Destino del formulario de /contacto — support@rollartfantasy.com, ya
// configurado con Cloudflare Email Routing (reenvía al Gmail del admin).
// Configurable por variable de entorno (CONTACT_EMAIL) para poder cambiarlo
// desde Vercel sin tocar código si hiciera falta más adelante.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "support@rollartfantasy.com";

// El nombre/email/mensaje del formulario de contacto los escribe cualquier
// visitante y se insertan tal cual en el HTML del email — sin esto, alguien
// podría meter una etiqueta <script> o <img onerror=...> en el mensaje y
// que se ejecutara al abrir el correo en un cliente que renderice HTML.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CONTACT_REASON_LABELS: Record<string, string> = {
  bug: "🐞 Bug / algo no funciona",
  help: "❓ Ayuda",
  suggestion: "💡 Sugerencia",
  other: "Otro",
};

export async function sendContactEmail(input: {
  name: string;
  email: string;
  reason: string;
  message: string;
}) {
  const reasonLabel = CONTACT_REASON_LABELS[input.reason] || input.reason;

  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY no configurada — mensaje de contacto solo registrado aquí:",
      input
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: CONTACT_EMAIL,
    // Responder directamente a este email contesta al usuario, no a
    // "onboarding@resend.dev" (el remitente técnico).
    replyTo: input.email,
    subject: `[Contacto Rollart Fantasy] ${reasonLabel} — ${input.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 4px;">Nuevo mensaje de contacto</h2>
        <p><strong>Tipo:</strong> ${escapeHtml(reasonLabel)}</p>
        <p><strong>Nombre:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        <p style="margin-top:16px;white-space:pre-wrap;border-top:1px solid #e2e8f0;padding-top:12px;">${escapeHtml(input.message)}</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY no configurada — no se ha enviado el email de verificación. Enlace de prueba:",
      verifyUrl
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Confirma tu email — Rollart Fantasy",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 4px;">¡Ya casi está!</h2>
        <p>Confirma tu email para poder iniciar sesión en tu cuenta de Rollart Fantasy.</p>
        <p style="margin: 24px 0;">
          <a
            href="${verifyUrl}"
            style="display:inline-block;background:#facc15;color:#0f172a;padding:10px 22px;border-radius:9999px;text-decoration:none;font-weight:600;"
          >
            Confirmar mi email
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">
          Este enlace caduca en 24 horas. Si no has creado una cuenta en Rollart Fantasy, puedes ignorar este correo sin problema.
        </p>
      </div>
    `,
  });
}
