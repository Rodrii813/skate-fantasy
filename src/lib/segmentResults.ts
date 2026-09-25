// Desglosa los resultados oficiales de un evento en 3 bloques — Corto,
// Largo y Total — calculados al vuelo a partir de lo que ya hay en la
// base de datos (segment1Score, segment2Score, totalScore, finalRank y
// ElementScore por segmento). No hace falta guardar rankings por segmento:
// se recalculan aquí cada vez que se renderiza la página.
//
// A qué segmento pertenece cada ElementScore se decide por su segmentId
// (el mismo criterio que usa src/lib/fantasyValidation.ts para los slots),
// nunca por el nombre del elemento.

import { isComponentSlotLabel } from "./fantasyValidation";

export interface SegmentResultRow {
  registrationId: string;
  rank: number | null;
  skaterName: string;
  country: string;
  total: number | null;
  tes: number;
  pcs: number;
  deductions: number;
}

export interface SegmentResultBlock {
  key: "short" | "long" | "total";
  title: string;
  rows: SegmentResultRow[];
}

interface ElementScoreLike {
  value: number;
  segmentId: string;
  elementCategory: { name: string };
}

interface RegistrationLike {
  id: string;
  totalScore: number | null;
  segment1Score: number | null;
  segment2Score: number | null;
  finalRank: number | null;
  skater: { firstName: string; lastName: string; country: string };
  elementScores: ElementScoreLike[];
}

interface SegmentLike {
  id: string;
  name: string;
  order: number;
}

function sumScores(scores: ElementScoreLike[], segmentIds: string[] | null, component: boolean): number {
  return scores
    .filter(
      (s) =>
        (segmentIds === null || segmentIds.includes(s.segmentId)) &&
        isComponentSlotLabel(s.elementCategory.name) === component
    )
    .reduce((acc, s) => acc + s.value, 0);
}

function buildRows(
  registrations: RegistrationLike[],
  scoreOf: (r: RegistrationLike) => number | null,
  segmentIdsForBreakdown: string[] | null,
  options: { includeUnscored: boolean; rankOf?: (r: RegistrationLike) => number | null }
): SegmentResultRow[] {
  const scored = registrations
    .filter((r) => scoreOf(r) !== null)
    .sort((a, b) => (scoreOf(b) as number) - (scoreOf(a) as number));
  const unscored = options.includeUnscored ? registrations.filter((r) => scoreOf(r) === null) : [];

  const toRow = (r: RegistrationLike, computedRank: number | null): SegmentResultRow => {
    const tes = Number(sumScores(r.elementScores, segmentIdsForBreakdown, false).toFixed(2));
    const pcs = Number(sumScores(r.elementScores, segmentIdsForBreakdown, true).toFixed(2));
    const total = scoreOf(r);
    const deductions = total !== null && (tes > 0 || pcs > 0) ? Number((tes + pcs - total).toFixed(2)) : 0;
    const rank = options.rankOf ? options.rankOf(r) ?? computedRank : computedRank;
    return {
      registrationId: r.id,
      rank,
      skaterName: `${r.skater.firstName} ${r.skater.lastName}`,
      country: r.skater.country,
      total,
      tes,
      pcs,
      deductions,
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

  if (shortSegment) {
    blocks.push({
      key: "short",
      title: shortSegment.name,
      rows: buildRows(registrations, (r) => r.segment1Score, [shortSegment.id], {
        includeUnscored: false,
      }),
    });
  }

  if (longSegment) {
    blocks.push({
      key: "long",
      title: longSegment.name,
      rows: buildRows(registrations, (r) => r.segment2Score, [longSegment.id], {
        includeUnscored: false,
      }),
    });
  }

  blocks.push({
    key: "total",
    title: "Total",
    rows: buildRows(registrations, (r) => r.totalScore, null, {
      includeUnscored: true,
      rankOf: (r) => r.finalRank,
    }),
  });

  return blocks;
}
