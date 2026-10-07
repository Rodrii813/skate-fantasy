// Redacción de los textos de normas/errores del Fantasy según a quién se elige
// en la prueba: masculino -> "patinador", Parejas -> "patinadores" (plural,
// cada elección es una pareja) y Show -> "grupo". Por defecto (femenino o sin
// género) se queda el texto original, escrito en "patinadora".
export type SkaterAudience = "female" | "male" | "pairs" | "show";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function getSkaterAudience(event: {
  gender?: string | null;
  discipline?: { name?: string | null } | null;
}): SkaterAudience {
  const d = norm(event.discipline?.name ?? "");
  if (d.includes("show")) return "show";
  if (d.includes("pareja") || d.includes("pair") || d.includes("couple")) return "pairs";
  if (event.gender === "MALE") return "male";
  return "female";
}

export function adaptSkaterText(text: string, audience: SkaterAudience, locale: "es" | "en" = "es"): string {
  if (audience === "female") return text;
  if (locale === "en") {
    if (audience !== "show") return text;
    return text.replace(/\bskaters\b/g, "groups").replace(/\bskater\b/g, "group");
  }
  const plural = audience === "show" ? "grupos" : "patinadores";
  const singular = audience === "show" ? "grupo" : "patinador";
  const masc = audience === "pairs" ? "los mismos" : "el mismo";
  let s = text;
  s = s.replace(/\bPocas\b/g, "Pocos");
  s = s.replace(/\bla misma patinadora\b/g, `${masc} ${singular}`);
  s = s.replace(/\bla misma\b/g, masc);
  s = s.replace(/\bcada una\b/g, "cada uno");
  s = s.replace(/\ba una que\b/g, "a uno que");
  s = s.replace(/\blas patinadoras\b/g, `los ${plural}`);
  s = s.replace(/\bla patinadora\b/g, `el ${singular}`);
  s = s.replace(/\buna patinadora\b/g, `un ${singular}`);
  s = s.replace(/\bpatinadoras\b/g, plural);
  s = s.replace(/\bpatinadora\b/g, singular);
  s = s.replace(/\ba el\b/g, "al");
  s = s.replace(/\btécnicas\b/g, "técnicos");
  s = s.replace(/\bmejor clasificadas\b/g, "mejor clasificados");
  return s;
}
