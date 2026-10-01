// Convierte el código de país que se guarda en Skater.country (en la
// práctica, el código de 3 letras del COI/IOC — el mismo que usa World
// Skate en sus protocolos oficiales, p.ej. "GER", "SUI", "NED" — que NO
// siempre coincide con el ISO 3166-1 alpha-3 real del país) en el emoji de
// su bandera. Un emoji de bandera se construye combinando los dos
// "regional indicator symbols" Unicode del código ISO 3166-1 ALPHA-2 del
// país (p.ej. "ES" -> 🇪🇸), así que hace falta esta tabla IOC -> alpha-2:
// no hay una fórmula que lo derive directamente del código de 3 letras.
//
// Cubre los países que compiten habitualmente en patinaje artístico/roller
// a nivel internacional (Europa, América, Asia, Oceanía, algo de África);
// si aparece un código que no está aquí, simplemente no se muestra bandera
// (mejor eso que arriesgarse a mostrar la bandera equivocada).
const IOC_TO_ISO2: Record<string, string> = {
  // Europa
  ALB: "AL", AND: "AD", ARM: "AM", AUT: "AT", AZE: "AZ", BLR: "BY", BEL: "BE",
  BIH: "BA", BUL: "BG", CRO: "HR", CYP: "CY", CZE: "CZ", DEN: "DK", ESP: "ES",
  EST: "EE", FIN: "FI", FRA: "FR", GBR: "GB", GEO: "GE", GER: "DE", GRE: "GR",
  HUN: "HU", IRL: "IE", ISL: "IS", ISR: "IL", ITA: "IT", LAT: "LV", LIE: "LI",
  LTU: "LT", LUX: "LU", MDA: "MD", MKD: "MK", MLT: "MT", MNE: "ME", MON: "MC",
  NED: "NL", NOR: "NO", POL: "PL", POR: "PT", ROU: "RO", RUS: "RU", SMR: "SM",
  SRB: "RS", SVK: "SK", SLO: "SI", SWE: "SE", SUI: "CH", TUR: "TR", UKR: "UA",

  // América
  ARG: "AR", BAH: "BS", BAR: "BB", BOL: "BO", BRA: "BR", CAN: "CA", CHI: "CL",
  COL: "CO", CRC: "CR", CUB: "CU", DOM: "DO", ECU: "EC", ESA: "SV", GUA: "GT",
  GUY: "GY", HON: "HN", JAM: "JM", MEX: "MX", NCA: "NI", PAN: "PA", PAR: "PY",
  PER: "PE", PUR: "PR", TTO: "TT", URU: "UY", USA: "US", VEN: "VE",

  // Asia
  CHN: "CN", HKG: "HK", INA: "ID", IND: "IN", IRI: "IR", JPN: "JP", KAZ: "KZ",
  KGZ: "KG", KOR: "KR", KUW: "KW", MAS: "MY", MGL: "MN", PHI: "PH", PRK: "KP",
  SGP: "SG", SRI: "LK", TPE: "TW", THA: "TH", UZB: "UZ", VIE: "VN",

  // Oceanía
  AUS: "AU", NZL: "NZ",

  // África y Oriente Medio
  EGY: "EG", MAR: "MA", RSA: "ZA", TUN: "TN", UAE: "AE",
};

// Unicode: cada letra ISO2 se traduce a su "regional indicator symbol"
// sumando 127397 (0x1F1A5) al código del carácter — así "ES" (69, 83) se
// convierte en 🇪 + 🇸, que los sistemas combinan en una sola bandera.
export function countryFlagEmoji(iocCode: string | null | undefined): string {
  if (!iocCode) return "";
  const iso2 = IOC_TO_ISO2[iocCode.trim().toUpperCase()];
  if (!iso2) return "";
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}
