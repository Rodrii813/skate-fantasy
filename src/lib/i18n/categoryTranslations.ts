import type { Locale } from "./config";

// Category.name y Discipline.name son texto libre en español introducido
// por el admin (un único campo `name`, sin columna de traducción — ver
// prisma/schema.prisma) y se muestran tal cual en toda la web pública. Al
// cambiar a inglés, esos nombres se quedaban en español porque no existía
// ningún mecanismo de traducción para ellos. En vez de añadir una columna
// nueva + migración + un formulario de admin (más esfuerzo y requeriría que
// el admin rellene la versión en inglés de cada categoría/disciplina), se
// usa esta tabla de equivalencias: cubre los nombres que ya existen y, si
// aparece uno que no está aquí (un admin crea una categoría nueva), se
// muestra el nombre original en vez de inventar una traducción.
//
// Las claves se comparan ignorando mayúsculas y acentos, para que no se
// rompa por un "Parejas" vs "parejas" o un acento distinto al tipeado aquí.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

const DISCIPLINE_NAME_EN: Record<string, string> = {
  libre: "Free Skating",
  parejas: "Pairs",
  "solo danza": "Solo Dance",
  "pareja danza": "Couple Dance",
  "parejas de danza": "Couple Dance",
  inline: "Inline",
  show: "Show",
  precision: "Precision",
  figuras: "Figures",
};

const CATEGORY_NAME_EN: Record<string, string> = {
  benjamin: "Mini",
  alevin: "Mini",
  infantil: "Espoir",
  cadete: "Cadet",
  juvenil: "Youth",
  junior: "Junior",
  senior: "Senior",
};

export function translateDisciplineName(name: string, locale: Locale): string {
  if (locale !== "en") return name;
  return DISCIPLINE_NAME_EN[normalize(name)] ?? name;
}

export function translateCategoryName(name: string, locale: Locale): string {
  if (locale !== "en") return name;
  return CATEGORY_NAME_EN[normalize(name)] ?? name;
}
