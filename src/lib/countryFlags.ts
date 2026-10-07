// Convierte el código de país que se guarda en Skater.country (en la
// práctica, el código de 3 letras del COI/IOC — el mismo que usa World
// Skate en sus protocolos oficiales, p.ej. "GER", "SUI", "NED" — que NO
// siempre coincide con el ISO 3166-1 alpha-3 real del país) en el emoji de
// su bandera. Un emoji de bandera se construye combinando los dos
// "regional indicator symbols" Unicode del código ISO 3166-1 ALPHA-2 del
// país (p.ej. "ES" -> 🇪🇸), así que hace falta esta tabla IOC -> alpha-2:
// no hay una fórmula que lo derive directamente del código de 3 letras.
//
// La tabla (iocCountries.ts) cubre todos los países; si aparece un código
// que no está, simplemente no se muestra bandera (mejor eso que arriesgarse
// a mostrar la bandera equivocada).
import { IOC_TO_ISO2 } from "./iocCountries";

// Unicode: cada letra ISO2 se traduce a su "regional indicator symbol"
// sumando 127397 (0x1F1A5) al código del carácter — así "ES" (69, 83) se
// convierte en 🇪 + 🇸, que los sistemas combinan en una sola bandera.
export function countryFlagEmoji(iocCode: string | null | undefined): string {
  if (!iocCode) return "";
  const iso2 = IOC_TO_ISO2[iocCode.trim().toUpperCase()];
  if (!iso2) return "";
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}
