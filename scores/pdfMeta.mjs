// Lectura de la cabecera y de las tablas-resumen del acta (nación/club, puesto,
// clasificación final). El detalle por patinador (elementos, jueces,
// componentes) lo sigue leyendo src/lib/pdfJudgesDetailTable.ts.
import { normalizeName } from "../src/lib/normalizeName.ts";

const clean = (s) => s.replace(/\s+/g, " ").trim();

export function parseHeader(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const idx = lines.findIndex((l) => /^RESULTS DETAILS\b/i.test(l));
  if (idx < 0) return null;
  const head = lines.slice(Math.max(0, idx - 4), idx).filter(Boolean);
  // línea 1: "<lugar> - dd/mm/aaaa"; línea 2: "<prueba> - <segmento>"; línea 3: título libre
  const dateLine = head.find((l) => /\d{2}\/\d{2}\/\d{4}\s*$/.test(l));
  if (!dateLine) return null;
  const dm = dateLine.match(/^(.*?)\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/);
  const location = dm ? clean(dm[1]) : null;
  const date = dm ? new Date(Date.UTC(+dm[4], +dm[3] - 1, +dm[2])) : null;
  const di = head.indexOf(dateLine);
  const evLine = head[di + 1];
  if (!evLine) return null;
  const cut = evLine.lastIndexOf(" - ");
  if (cut < 0) return null;
  const eventName = clean(evLine.slice(0, cut));
  const segmentName = clean(evLine.slice(cut + 3));
  const titleHint = head[di + 2] ? clean(head[di + 2]) : null;
  return { location, date, eventName, segmentName, titleHint };
}

export function deriveEventInfo(eventName) {
  const n = eventName;
  const gender = /\b(Men|Male)\b/i.test(n) ? "MEN" : /\b(Ladies|Women|Female)\b/i.test(n) ? "LADIES" : null;
  const cat = n.match(/\b(Seniores|Juniores|Seniors?|Juniors?|Youth|Cadets?|Juvenil(?:es)?|Infantil(?:es)?|Cadetes?|Prejuvenil(?:es)?|Benjamin(?:es)?|Alevin(?:es)?|Master|Adult)\b/i);
  let discipline = null;
  if (/^Inline/i.test(n)) discipline = "Inline Free Skating";
  else if (/^Free Skating/i.test(n)) discipline = "Free Skating";
  else if (/Solo Dance/i.test(n)) discipline = "Solo Dance";
  else if (/Couple Dance|Pair Dance|Dance Couple/i.test(n)) discipline = "Couple Dance";
  else if (/Pairs/i.test(n)) discipline = "Pairs";
  else if (/Show|Quartet/i.test(n)) discipline = "Show";
  else if (/Precision/i.test(n)) discipline = "Precision";
  return { gender, category: cat ? cat[1] : null, discipline };
}

export function segmentOrder(name) {
  return /short|style|rhythm|original|compulsory/i.test(name) ? 1 : 2;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Tabla "RESULTS DETAILS": una fila por patinador con TES PCS DED Total +
// (nación | club) + nombre + puesto. Se localiza cada nombre conocido (los de
// las tablas de detalle) para separar bien nación/club, nombre y puesto.
export function parseResultsTable(text, names) {
  const lines = text.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => /^RESULTS DETAILS\b/i.test(l));
  if (start < 0) return new Map();
  let end = lines.findIndex((l, i) => i > start && /^TECHNICAL PANEL/i.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end);
  const recStart = /^\d+\.\d\d \d+\.\d\d -?\d+(?:\.\d+)? \d+\.\d\d/;
  const records = [];
  for (const l of body) {
    if (recStart.test(l)) records.push(l);
    else if (records.length && l) records[records.length - 1] += " " + l;
  }
  const out = new Map();
  for (const rec of records) {
    const m = rec.match(/^\d+\.\d\d \d+\.\d\d -?\d+(?:\.\d+)? \d+\.\d\d\s*(.*)$/);
    if (!m) continue;
    const rest = clean(m[1]);
    for (const name of names) {
      // Parejas: en el acta el nombre va "A B" en dos líneas, en el detalle "A - B".
      const nm = clean(name).replace(/\s+-\s*/g, " ");
      const r = rest.match(new RegExp("^(.*?)" + escapeRe(nm).replace(/ /g, "\\s+(?:-\\s*)?") + "\\s*(\\d+)\\s*R?$"));
      if (r) {
        const origin = clean(r[1]);
        const isNation = /^[A-Z]{3}$/.test(origin);
        out.set(name, { rank: Number(r[2]), country: isNation ? origin : null, club: origin && !isNation ? origin : null });
        break;
      }
    }
  }
  return out;
}

// Página "FINAL RESULT": Pl., puesto en cada segmento, nación/club, puntos, nombre.
export function parseFinalResult(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => /^FINAL RESULT$/i.test(l));
  if (start < 0) return [];
  let end = lines.findIndex((l, i) => i > start && /^WORLDSKATE/i.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).filter((l) => !/^Pl\.\s/.test(l));
  const rows = [];
  let cur = null;
  const head = /^(\d{1,3}) (\d{1,3}|-) (\d{1,3}|-)(?=\S)(.*)$/;
  for (const l of body) {
    const h = l.match(head);
    if (h) {
      if (cur) rows.push(cur);
      cur = { rank: Number(h[1]), text: h[4] };
    } else if (cur && l) cur.text += " " + l;
  }
  if (cur) rows.push(cur);
  const out = [];
  for (const r of rows) {
    const m = clean(r.text).match(/^(.*?)\s*(\d{2,3}\.\d\d)\s*(\S.*)$/);
    if (!m) continue;
    out.push({ rank: r.rank, points: Number(m[2]), name: clean(m[3]), origin: clean(m[1]) });
  }
  return out;
}

// Clave para casar el nombre de la clasificación final con el del detalle
// (parejas: "A - B" en uno y "A B" en el otro).
export function nameKey(n) {
  return normalizeName(n).replace(/\s+-\s*/g, " ").replace(/\s+/g, " ").trim();
}

// "A - B" -> ["A", "B"]; un nombre sin " - " es una sola persona.
export function splitTeam(name) {
  const parts = name.split(/\s+-\s*/).map((x) => x.trim()).filter(Boolean);
  return parts.length === 2 ? parts : [name.trim()];
}

export { normalizeName };
