// Detalle completo por patinador del acta "JUDGES DETAILS PER SKATER":
// cada elemento con su valor base, QOE, notas de cada juez y puntuación del
// panel, más los components por juez. Es un parser APARTE del que calcula las
// puntuaciones de Fantasy (pdfJudgesDetailsParser): solo sirve para MOSTRAR
// el desglose, nunca influye en los totales. Si algo no cuadra con el acta
// (la suma de elementos no da el TES), no se devuelve detalle para ese
// patinador en vez de enseñar datos dudosos.
//
// El texto que da unpdf trae las notas de los jueces pegadas y en orden
// inverso (J6…J1), p.ej. "+100+1+100.40" = notas "+1 0 0 +1 +1 0" + QOE 0.40,
// que leídas al revés son J1..J6.

export interface DetailRow {
  code: string; // 2A, 3S, HBD…
  name: string; // "2 Axel", "Heel Backward Spin"
  marks: string; // "<<<", "<", "*"…
  flags: string; // "%", "%+"…
  base: number | null;
  qoe: number | null;
  score: number | null;
  judges: number[]; // J1..Jn (vacío en las líneas de spin)
}

export interface DetailElement {
  n: number;
  type: string; // ComboJump, Jump, ComboSpin, Step Sequence…
  judges: number[]; // notas del elemento cuando van en la cabecera (spins)
  rows: DetailRow[];
}

export interface DetailComponent {
  name: string;
  factor: number;
  judges: number[];
  score: number;
}

export interface SkaterDetailTable {
  name: string;
  judgeCount: number;
  elements: DetailElement[];
  baseTotal: number | null;
  qoeTotal: number | null;
  components: DetailComponent[];
  tes: number | null;
  pcs: number | null;
  ded: number | null;
  total: number | null;
}

const JT = String.raw`(?:[+-]\d|\d)`;
const NUM = String.raw`\d+\.\d\d`;

function parseJudgeString(s: string): number[] | null {
  const toks = s.match(/[+-]\d|\d/g);
  if (!toks) return s === "" ? [] : null;
  if (toks.join("") !== s) return null;
  return toks.map(Number).reverse(); // el texto viene J6…J1
}

function splitNameCode(raw: string): { name: string; code: string } {
  const m = raw.match(
    /^(.*?(?:Axel|Toeloop|Loop|Salchow|Flip|Lutz|Jump|Spin|Level|Step|[Ss]equence|Spiral|Lift|Twist|Throw|Seq|Traveling|Cluster|Wheel|Line|Block|Element|Intersection|Move|Creative|Canon|Stop))(.+)$/
  );
  if (m) return { name: m[1].trim(), code: m[2].trim() };
  const m2 = raw.match(/^(.*[a-z])([A-Z0-9][A-Za-z0-9]*)$/);
  if (m2) return { name: m2[1].trim(), code: m2[2] };
  return { name: raw.trim(), code: "" };
}

function parseRowRemainder(
  rem: string,
  judgeCount: number
): { type?: string; n?: number; row: Omit<DetailRow, "base" | "score">; ok: boolean } | null {
  const tokens = rem.trim().split(/\s+/);
  const last = tokens.pop();
  if (!last) return null;
  const jq = last.match(new RegExp(`^(${JT}*?)(-?\\d\\.\\d\\d)?([%+*!HBTe]*)$`));
  if (!jq) return null;
  const judges = parseJudgeString(jq[1]);
  if (!judges) return null;
  const qoe = jq[2] !== undefined ? Number(jq[2]) : null;
  const flags = jq[3] || "";
  const marks: string[] = [];
  while (tokens.length > 1 && /^(<{1,3}|\*|!|B|H|T|e)+$/.test(tokens[tokens.length - 1])) {
    marks.unshift(tokens.pop() as string);
  }
  let namePart = tokens.join(" ");
  let type: string | undefined;
  let n: number | undefined;
  const mm = namePart.match(/^([A-Za-z][A-Za-z ]*?)(\d+) (.*)$/);
  if (mm) {
    type = mm[1].trim();
    n = Number(mm[2]);
    namePart = mm[3];
  }
  const { name, code } = splitNameCode(namePart);
  const ok = judges.length === 0 || judges.length === judgeCount;
  return { type, n, row: { code, name, marks: marks.join(" "), flags, qoe, judges }, ok };
}

function parseChunk(chunk: string): SkaterDetailTable | null {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0];
  if (!name) return null;

  // Components + nº de jueces
  const components: DetailComponent[] = [];
  let judgeCount = 0;
  for (const l of lines) {
    const m = l.match(new RegExp(`^(.*?)((?: ${NUM})+) (${NUM})(\\d+(?:\\.\\d+)?)$`));
    if (!m) continue;
    if (/^(Judges Total|Total|Deductions)/i.test(m[1])) continue;
    const vals = m[2].trim().split(/\s+/).map(Number);
    components.push({ name: m[1].trim(), factor: Number(m[4]), judges: vals, score: Number(m[3]) });
    judgeCount = vals.length;
  }
  if (components.length === 0 || judgeCount === 0) return null;

  const elements: DetailElement[] = [];
  let current: DetailElement | null = null;
  let valid = true;
  let baseTotal: number | null = null;
  let qoeTotal: number | null = null;
  let tes: number | null = null;
  let pcs: number | null = null;
  let ded: number | null = null;
  let total: number | null = null;

  for (const l of lines) {
    if (/^Program Components/.test(l)) break;

    if (new RegExp(`^${NUM} ${NUM} -?${NUM} ${NUM}$`).test(l)) continue;

    const tot = l.match(new RegExp(`^(${NUM})(${NUM}) (-?${NUM})$`));
    if (tot) {
      tes = Number(tot[1]);
      baseTotal = Number(tot[2]);
      qoeTotal = Number(tot[3]);
      continue;
    }

    // Cabecera de spin/combo: notas pegadas + tipo + nº, sin valores
    const head = l.match(new RegExp(`^(${JT}+)([A-Za-z][A-Za-z ]*?)(\\d+)$`));
    if (head && /Spin|[Ss]equence|Step|Lift|Element/i.test(head[2])) {
      const judges = parseJudgeString(head[1]);
      if (judges && judges.length === judgeCount) {
        current = { n: Number(head[3]), type: head[2].trim(), judges, rows: [] };
        elements.push(current);
        continue;
      }
    }

    const v = l.match(new RegExp(`^(${NUM})(?: (${NUM}))?(.*)$`));
    if (!v) continue;
    const parsed = parseRowRemainder(v[3], judgeCount);
    if (!parsed) continue;
    if (!parsed.ok) valid = false;
    const row: DetailRow = {
      ...parsed.row,
      base: Number(v[1]),
      score: v[2] !== undefined ? Number(v[2]) : null,
    };
    if (parsed.type !== undefined && parsed.n !== undefined) {
      current = { n: parsed.n, type: parsed.type, judges: [], rows: [row] };
      elements.push(current);
    } else if (current) {
      current.rows.push(row);
    } else {
      valid = false;
    }
  }

  // Línea final "TES PCS DED TOTAL"
  for (const l of lines) {
    const m = l.match(new RegExp(`^(${NUM}) (${NUM}) (-?${NUM}) (${NUM})$`));
    if (m) {
      tes = Number(m[1]);
      pcs = Number(m[2]);
      ded = Number(m[3]);
      total = Number(m[4]);
    }
  }

  if (!valid || elements.length === 0 || tes === null) return null;

  // Control de integridad: la suma de puntuaciones de elementos = TES
  const sum = elements.reduce(
    (a, e) => a + e.rows.reduce((b, r) => b + (r.score ?? 0), 0),
    0
  );
  if (Math.abs(sum - tes) > 0.06) return null;

  return { name, judgeCount, elements, baseTotal, qoeTotal, components, tes, pcs, ded, total };
}

export function parseJudgesDetailTables(pdfText: string): SkaterDetailTable[] {
  const chunks = pdfText.split(/JUDGES DETAILS PER SKATER/i).slice(1);
  const out: SkaterDetailTable[] = [];
  for (const c of chunks) {
    try {
      const t = parseChunk(c);
      if (t) out.push(t);
    } catch {
      /* un patinador raro no debe romper nada */
    }
  }
  return out;
}
