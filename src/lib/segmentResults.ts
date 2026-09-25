// Desglosa los resultados oficiales de un evento en 3 bloques — Corto,
// Largo y Total — calculados al vuelo a partir de lo que ya hay en la
// base de datos. No hace falta guardar rankings por segmento: se recalculan
// aquí cada vez que se renderiza la página.
//
// TES/PCS/Deducciones se muestran tal cual los guardó
// upload-judges-details/route.ts a partir del acta oficial
// (segment1Tes/Pcs/Ded, segment2Tes/Pcs/Ded) — NO se reconstruyen sumando
// los ElementScore de los slots de Fantasy. Esos slots solo cuentan "los
// mejores N" de cada tipo de elemento (por diseño del juego), así que casi
// nunca cuadran con el total real de la competición: por ejemplo, si un
// programa tiene más saltos de los que hay slots para elegir, el sobrante
// se pierde a propósito en Fantasy pero SÍ cuenta en el resultado oficial.
// Reconstruirlo así producía TES/PCS más bajos que los reales y una columna
// de Deducciones sin sentido (con el signo invertido, además).

export interface SegmentResultRow {
  registrationId: string;
  rank: number | null;
  skaterName: string;
  country: string;
  total: number | null;
  tes: number;
  pcs: number;
  deductions: number;
  // Solo se rellenan en el bloque "total": puesto y puntos que sacó cada
  // patinadora en cada segmento por separado. El bloque Total ya no repite
  // el desglose técnico (TES/PCS/Deducciones, que se ve en sus propios
  // bloques de Corto y Largo más arriba) — en su lugar muestra "puesto y
  // puntos del Corto", "puesto y puntos del Largo" y la suma final.
  shortRank?: number | null;
  shortScore?: number | null;
  longRank?: number | null;
  longScore?: number | null;
}

export interface SegmentResultBlock {
  key: "short" | "long" | "total";
  title: string;
  rows: SegmentResultRow[];
}

interface RegistrationLike {
  id: string;
  totalScore: number | null;
  segment1Score: number | null;
  segment2Score: number | null;
  segment1Tes: number | null;
  segment1Pcs: number | null;
  segment1Ded: number | null;
  segment2Tes: number | null;
  segment2Pcs: number | null;
  segment2Ded: number | null;
  finalRank: number | null;
  skater: { firstName: string; lastName: string; country: string };
}

interface SegmentLike {
  id: string;
  name: string;
  order: number;
}

function buildRows(
  registrations: RegistrationLike[],
  scoreOf: (r: RegistrationLike) => number | null,
  breakdownOf: (r: RegistrationLike) => { tes: number | null; pcs: number | null; ded: number | null },
  options: { includeUnscored: boolean; rankOf?: (r: RegistrationLike) => number | null }
): SegmentResultRow[] {
  const scored = registrations
    .filter((r) => scoreOf(r) !== null)
    .sort((a, b) => (scoreOf(b) as number) - (scoreOf(a) as number));
  const unscored = options.includeUnscored ? registrations.filter((r) => scoreOf(r) === null) : [];

  const toRow = (r: RegistrationLike, computedRank: number | null): SegmentResultRow => {
    const { tes, pcs, ded } = breakdownOf(r);
    const total = scoreOf(r);
    const rank = options.rankOf ? options.rankOf(r) ?? computedRank : computedRank;
    return {
      registrationId: r.id,
      rank,
      skaterName: `${r.skater.firstName} ${r.skater.lastName}`,
      country: r.skater.country,
      total,
      tes: tes ?? 0,
      pcs: pcs ?? 0,
      deductions: ded ?? 0,
    };
  };

  const scoredRows = scored.map((r, index) => toRow(r, index + 1));
  const unscoredRows = unscored.map((r) => toRow(r, null));

  return [...scoredRows, ...unscoredRows];
}

/**
 * Construye las filas del bloque "Total": no recalcula nada nuevo, solo
 * junta el puesto+puntos que cada patinadora ya sacó en el bloque de Corto
 * y en el de Largo (recibidos ya calculados) junto con el total oficial.
 */
function buildTotalRows(
  registrations: RegistrationLike[],
  shortRows: SegmentResultRow[],
  longRows: SegmentResultRow[]
): SegmentResultRow[] {
  const shortByReg = new Map(shortRows.map((r) => [r.registrationId, r]));
  const longByReg = new Map(longRows.map((r) => [r.registrationId, r]));

  const scored = registrations
    .filter((r) => r.totalScore !== null)
    .sort((a, b) => (b.totalScore as number) - (a.totalScore as number));
  const unscored = registrations.filter((r) => r.totalScore === null);

  const toRow = (r: RegistrationLike, computedRank: number | null): SegmentResultRow => {
    const shortRow = shortByReg.get(r.id);
    const longRow = longByReg.get(r.id);
    return {
      registrationId: r.id,
      rank: r.finalRank ?? computedRank,
      skaterName: `${r.skater.firstName} ${r.skater.lastName}`,
      country: r.skater.country,
      total: r.totalScore,
      tes: 0,
      pcs: 0,
      deductions: 0,
      shortRank: shortRow?.rank ?? null,
      shortScore: shortRow?.total ?? null,
      longRank: longRow?.rank ?? null,
      longScore: longRow?.total ?? null,
    };
  };

  const scoredRows = scored.map((r, index) => toRow(r, index + 1));
  const unscoredRows = unscored.map((r) => toRow(r, null));

  return [...scoredRows, ...unscoredRows];
}

/**
 * Calcula los 3 bloques de resultados (Corto, Largo, Total) de un evento.
 * Corto y Largo solo incluyen a quien ya tiene puntuación en ESE segmento
 * (no tiene sentido mostrar filas vacías para un segmento que todavía no se
 * ha disputado). Total incluye a todas las inscritas, con "—" para quien
 * aún no tenga totalScore, igual que la tabla combinada anterior.
 */
export function computeSegmentResultBlocks(
  segments: SegmentLike[],
  registrations: RegistrationLike[]
): SegmentResultBlock[] {
  const orderedSegments = [...segments].sort((a, b) => a.order - b.order);
  const shortSegment = orderedSegments[0];
  const longSegment = orderedSegments[1];

  const blocks: SegmentResultBlock[] = [];

  const shortRows = shortSegment
    ? buildRows(
        registrations,
        (r) => r.segment1Score,
        (r) => ({ tes: r.segment1Tes, pcs: r.segment1Pcs, ded: r.segment1Ded }),
        { includeUnscored: false }
      )
    : [];

  const longRows = longSegment
    ? buildRows(
        registrations,
        (r) => r.segment2Score,
        (r) => ({ tes: r.segment2Tes, pcs: r.segment2Pcs, ded: r.segment2Ded }),
        { includeUnscored: false }
      )
    : [];

  if (shortSegment) blocks.push({ key: "short", title: shortSegment.name, rows: shortRows });
  if (longSegment) blocks.push({ key: "long", title: longSegment.name, rows: longRows });

  blocks.push({
    key: "total",
    title: "Total",
    rows: buildTotalRows(registrations, shortRows, longRows),
  });

  return blocks;
}
