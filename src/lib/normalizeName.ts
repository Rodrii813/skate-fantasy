// Normaliza un nombre para COMPARAR (nunca para guardar ni mostrar): quita
// acentos/diacríticos, colapsa espacios repetidos y pasa a minúsculas. Se
// usa tanto al importar un PDF de orden de salida (para no crear un Skater
// duplicado cuando el mismo patinador aparece con el nombre escrito de
// forma ligeramente distinta entre actas — típico con acentos, "Ñ" o
// espacios extra que deja la extracción de texto del PDF) como en el panel
// de admin (para señalar posibles duplicados ya existentes).
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita las marcas diacríticas (á→a, ñ→n, ü→u...)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
