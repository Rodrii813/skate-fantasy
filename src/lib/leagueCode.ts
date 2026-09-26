// Código de invitación de una liga privada. Se usa un alfabeto sin
// caracteres ambiguos (0/O, 1/I) para que sea fácil de compartir por
// WhatsApp/voz sin errores de transcripción.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLeagueCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}
