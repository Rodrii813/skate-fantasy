// Interruptor de la verificación de email al registrarse.
//
// Por defecto está DESACTIVADA (los usuarios entran nada más crear la cuenta,
// sin gastar emails de Resend). Para volver a exigirla basta con poner la
// variable de entorno REQUIRE_EMAIL_VERIFICATION="true" en Vercel y
// redesplegar; no hace falta tocar código.
export const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === "true";
