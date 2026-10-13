import { normalizeName } from "../src/lib/normalizeName.ts";

const accents = (s) => (s.match(/[^\x00-\x7F]/g) || []).length;

// Encuentra (o crea) a la Persona de un resultado. Devuelve { person, how }
// con how = "matched" | "created" | "homonym" | "ambiguous" para que el
// importador lo enseñe y puedas revisar los casos dudosos.
export async function resolvePerson(db, name, country) {
  const norm = normalizeName(name);
  const alias = await db.personAlias.findUnique({ where: { alias: norm } });
  let cands;
  if (alias) {
    const p = await db.person.findUnique({ where: { id: alias.personId } });
    cands = p ? [p] : [];
  } else {
    cands = await db.person.findMany({ where: { normName: norm } });
  }
  let match = null;
  let how = "created";
  if (cands.length === 1) {
    const c = cands[0];
    if (!country || !c.country || c.country === country) {
      match = c;
      how = "matched";
    } else how = "homonym"; // mismo nombre, país distinto: se crea otra persona
  } else if (cands.length > 1) {
    match = cands.find((c) => c.country === country) || null;
    if (match) how = "matched";
    else if (!country) {
      match = cands[0];
      how = "ambiguous";
    } else how = "homonym";
  }
  if (!match) {
    const person = await db.person.create({ data: { name, normName: norm, country: country || null } });
    return { person, how };
  }
  const data = {};
  if (country && !match.country) data.country = country;
  if (accents(name) > accents(match.name)) data.name = name;
  if (Object.keys(data).length) match = await db.person.update({ where: { id: match.id }, data });
  return { person: match, how };
}
