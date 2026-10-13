// Importa actas PDF (resultados detallados de RollArt) a la base de datos de
// Rollart Scores. Por defecto SOLO LEE y enseña lo que haría (dry-run); con
// --apply escribe en la base de datos (SCORES_DATABASE_URL).
//
//   node --import tsx scores/import-pdf.mjs acta1.pdf acta2.pdf \
//        --competition "Campeonato de Europa 2026" --season 2026
//   node --env-file=.env.scores --import tsx scores/import-pdf.mjs acta.pdf \
//        --competition "Campeonato de Europa 2026" --season 2026 --apply
import fs from "node:fs";
import path from "node:path";
import { extractText } from "unpdf";
import { parseJudgesDetailTables } from "../src/lib/pdfJudgesDetailTable.ts";
import { parseHeader, deriveEventInfo, segmentOrder, parseResultsTable, parseFinalResult } from "./pdfMeta.mjs";
import { resolvePerson } from "./personMatch.mjs";
import { normalizeName } from "../src/lib/normalizeName.ts";

const argv = process.argv.slice(2);
const files = [];
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--apply") opt.apply = true;
  else if (a.startsWith("--")) opt[a.slice(2)] = argv[++i];
  else files.push(a);
}
if (!files.length || !opt.competition || !opt.season) {
  console.error('Uso: import-pdf.mjs <pdf...> --competition "Nombre" --season 2026 [--apply]');
  process.exit(1);
}

export async function readPdf(file) {
  const buf = new Uint8Array(fs.readFileSync(file));
  const { text } = await extractText(buf);
  const full = Array.isArray(text) ? text.join("\n") : text;
  const header = parseHeader(full);
  if (!header) throw new Error("No encuentro la cabecera (RESULTS DETAILS) en " + path.basename(file));
  const details = parseJudgesDetailTables(full);
  if (!details.length) throw new Error("No se han podido leer resultados detallados en " + path.basename(file));
  const table = parseResultsTable(full, details.map((d) => d.name));
  const final = parseFinalResult(full);
  return { file, header, details, table, final };
}

function summarize(p) {
  const { header, details, table, final } = p;
  console.log(`\n== ${path.basename(p.file)}`);
  console.log(`   ${header.eventName} · ${header.segmentName} · ${header.location} · ${header.date?.toISOString().slice(0, 10)}`);
  console.log(`   título del acta: ${header.titleHint}`);
  console.log(`   patinadores con detalle: ${details.length} · con puesto/origen: ${table.size} · clasificación final: ${final.length}`);
  for (const d of details) {
    const t = table.get(d.name);
    console.log(`   ${String(t?.rank ?? "?").padStart(2)} ${d.name} | ${t?.country ?? t?.club ?? "?"} | TES ${d.tes} PCS ${d.pcs} DED ${d.ded} = ${d.total}`);
  }
}

async function apply(parsed) {
  const { PrismaClient } = await import("./generated/client/index.js");
  const db = new PrismaClient();
  const people = { matched: 0, created: 0, homonym: [], ambiguous: [] };
  try {
    for (const p of parsed) {
      const { header, details, table, final } = p;
      const info = deriveEventInfo(header.eventName);
      const season = String(opt.season);
      const comp = await db.competition.upsert({
        where: { season_name: { season, name: opt.competition } },
        create: { name: opt.competition, season, location: header.location, startDate: header.date, endDate: header.date },
        update: {},
      });
      const upd = {};
      if (header.date && (!comp.startDate || header.date < comp.startDate)) upd.startDate = header.date;
      if (header.date && (!comp.endDate || header.date > comp.endDate)) upd.endDate = header.date;
      if (header.location && !comp.location) upd.location = header.location;
      if (Object.keys(upd).length) await db.competition.update({ where: { id: comp.id }, data: upd });

      const event = await db.event.upsert({
        where: { competitionId_name: { competitionId: comp.id, name: header.eventName } },
        create: { competitionId: comp.id, name: header.eventName, ...info },
        update: {},
      });
      const segment = await db.segment.upsert({
        where: { eventId_name: { eventId: event.id, name: header.segmentName } },
        create: { eventId: event.id, name: header.segmentName, order: segmentOrder(header.segmentName), date: header.date },
        update: { date: header.date },
      });
      const finalByName = new Map(final.map((f) => [normalizeName(f.name), f]));

      for (const d of details) {
        const t = table.get(d.name) || {};
        const { person, how } = await resolvePerson(db, d.name, t.country || null);
        if (how === "matched") people.matched++;
        else if (how === "created") people.created++;
        else if (how === "homonym") people.homonym.push(d.name);
        else if (how === "ambiguous") people.ambiguous.push(d.name);
        const f = finalByName.get(normalizeName(d.name));
        const entryData = {
          country: t.country || undefined,
          club: t.club || undefined,
          finalRank: f ? f.rank : undefined,
          points: f ? f.points : undefined,
        };
        const entry = await db.entry.upsert({
          where: { eventId_personId: { eventId: event.id, personId: person.id } },
          create: { eventId: event.id, personId: person.id, ...entryData },
          update: entryData,
        });
        const res = { rank: t.rank ?? null, tes: d.tes, pcs: d.pcs, ded: d.ded, total: d.total, detail: d };
        await db.segmentResult.upsert({
          where: { entryId_segmentId: { entryId: entry.id, segmentId: segment.id } },
          create: { entryId: entry.id, segmentId: segment.id, ...res },
          update: res,
        });
      }
      console.log(`OK ${path.basename(p.file)}: ${details.length} resultados en ${header.eventName} · ${header.segmentName}`);
    }
  } finally {
    await db.$disconnect();
  }
  console.log(`\nPersonas: ${people.matched} reconocidas, ${people.created} nuevas.`);
  if (people.homonym.length) console.log("REVISAR (mismo nombre, otro país, se creó otra persona):", people.homonym.join(", "));
  if (people.ambiguous.length) console.log("REVISAR (varios con el mismo nombre, se usó el primero):", people.ambiguous.join(", "));
}

const parsed = [];
for (const f of files) {
  const p = await readPdf(f);
  parsed.push(p);
  summarize(p);
}
if (opt.apply) await apply(parsed);
else console.log("\n(Simulación: no se ha escrito nada. Añade --apply para guardar en la base de datos.)");
