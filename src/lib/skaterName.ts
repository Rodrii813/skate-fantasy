// Nombre para MOSTRAR de un Skater. En Parejas y Pareja Danza un "Skater" es
// la pareja entera (firstName = él/ella A, lastName = el/la otro/a, ver el
// importador de órdenes de salida), así que se muestran separados por " / "
// para distinguir a cada uno. En el resto de disciplinas, "Nombre Apellido".
export function isPairDiscipline(name?: string | null): boolean {
  const d = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return d.includes("pareja") || d.includes("pair") || d.includes("couple");
}

export function formatSkaterName(
  skater: { firstName: string; lastName: string; discipline?: { name?: string | null } | null },
  isPair?: boolean
): string {
  const pair = isPair ?? isPairDiscipline(skater.discipline?.name);
  return pair && skater.lastName ? `${skater.firstName} / ${skater.lastName}` : `${skater.firstName} ${skater.lastName}`.trim();
}
