const IOC_TO_ISO2: Record<string, string> = {
  ESP: "es",
  POR: "pt",
  ITA: "it",
  FRA: "fr",
  GER: "de",
  AND: "ad",
  NED: "nl",
  DEN: "dk",
  SLO: "si",
  ISR: "il",
  RUS: "ru",
  SUI: "ch",
  CZE: "cz",
  CRO: "hr",
  AUT: "at",
  USA: "us",
  ARG: "ar",
  BRA: "br",
  COL: "co",
  CHI: "cl",
  PAR: "py",
  JPN: "jp",
  KAZ: "kz",
  BEL: "be",
  TUR: "tr",
};

export function getCountryCode2(countryCode?: string | null): string {
  if (!countryCode) return "";
  const upper = countryCode.trim().toUpperCase();
  return IOC_TO_ISO2[upper] || upper.toLowerCase().slice(0, 2);
}

// Banderas en formato texto/emoji alternativo
export function getCountryFlag(countryCode?: string | null): string {
  if (!countryCode) return "🏳️";
  const upper = countryCode.trim().toUpperCase();
  const flags: Record<string, string> = {
    ESP: "🇪🇸",
    POR: "🇵🇹",
    ITA: "🇮🇹",
    FRA: "🇫🇷",
    GER: "🇩🇪",
    AND: "🇦🇩",
    NED: "🇳🇱",
    DEN: "🇩🇰",
    SLO: "🇸🇮",
    ISR: "🇮🇱",
    RUS: "🇷🇺",
    SUI: "🇨🇭",
    CZE: "🇨🇿",
    CRO: "🇭🇷",
    AUT: "🇦🇹",
    USA: "🇺🇸",
    ARG: "🇦🇷",
    BRA: "🇧🇷",
    COL: "🇨🇴",
    CHI: "🇨🇱",
    PAR: "🇵🇾",
    JPN: "🇯🇵",
    KAZ: "🇰🇿",
    BEL: "🇧🇪",
    TUR: "🇹🇷",
  };
  // Antes, un código de país desconocido (typo, dato corrupto...) se
  // mostraba tal cual entre corchetes ("[FOR]"), lo que parecía una segunda
  // bandera/etiqueta rara al lado del país real. Mejor mostrar una bandera
  // neutra: así se ve que falta el dato, sin imprimir el código roto.
  return flags[upper] || "🏳️";
}