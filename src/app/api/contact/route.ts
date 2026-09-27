import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email";

const VALID_REASONS = ["bug", "help", "suggestion", "other"];

// Sin autenticación a propósito (cualquiera puede escribir, incluso sin
// cuenta) — protegido con: 1) un campo "website" oculto (honeypot: un
// humano nunca lo rellena, un bot de formularios sí) y 2) límites de
// longitud para no dejar mandar mensajes gigantes.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, reason, message, website } = body;

    // Honeypot: si viene relleno, es un bot — respondemos "ok" igualmente
    // (para no darle pistas de que fue detectado) sin enviar nada.
    if (typeof website === "string" && website.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      return NextResponse.json(
        { error: "Nombre, email y mensaje son obligatorios." },
        { status: 400 }
      );
    }
    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "Motivo no válido." }, { status: 400 });
    }
    if (trimmedName.length > 100 || trimmedEmail.length > 200) {
      return NextResponse.json({ error: "Nombre o email demasiado largos." }, { status: 400 });
    }
    if (trimmedMessage.length > 4000) {
      return NextResponse.json(
        { error: "El mensaje es demasiado largo (máx. 4000 caracteres)." },
        { status: 400 }
      );
    }

    await sendContactEmail({ name: trimmedName, email: trimmedEmail, reason, message: trimmedMessage });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error enviando mensaje de contacto:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
