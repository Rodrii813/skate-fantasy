-- Libre (no Inline), Programa Largo: "Combo Jump 1/2" y "Solo Jump 1/2" pasan a
-- "Best Combo Jump" / "2nd Best Combo Jump" y "Best Solo Jump" / "2nd Best Solo
-- Jump" (el segundo slot puntúa con el SEGUNDO mejor combo/salto de la
-- patinadora).
--
-- Se renombran los slots YA EXISTENTES en su sitio (mismo id de slot), así que
-- los drafts guardados de los usuarios se conservan intactos. Solo se tocan los
-- slots que todavía NO tienen ninguna puntuación cargada: si un evento ya
-- puntuó con los nombres antiguos, se deja exactamente como está.
INSERT INTO "ElementCategory" ("id", "name", "slug")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || v.slug), 1, 24), v.name, v.slug
FROM (VALUES
  ('Best Combo Jump', 'best-combo-jump'),
  ('2nd Best Combo Jump', '2nd-best-combo-jump'),
  ('Best Solo Jump', 'best-solo-jump'),
  ('2nd Best Solo Jump', '2nd-best-solo-jump')
) AS v(name, slug)
WHERE NOT EXISTS (
  SELECT 1 FROM "ElementCategory" c WHERE c."name" = v.name OR c."slug" = v.slug
);

UPDATE "FantasySlot" fs
SET "label" = m.new_label,
    "elementCategoryId" = (SELECT c."id" FROM "ElementCategory" c WHERE c."name" = m.new_label)
FROM (VALUES
  ('Combo Jump 1', 'Best Combo Jump'),
  ('Combo Jump 2', '2nd Best Combo Jump'),
  ('Solo Jump 1', 'Best Solo Jump'),
  ('Solo Jump 2', '2nd Best Solo Jump')
) AS m(old_label, new_label),
"Event" e,
"Discipline" d,
"Segment" s
WHERE fs."eventId" = e."id"
  AND e."disciplineId" = d."id"
  AND d."slug" = 'libre'
  AND fs."segmentId" = s."id"
  AND s."order" >= 2
  AND fs."label" = m.old_label
  AND NOT EXISTS (
    SELECT 1 FROM "ElementScore" es
    WHERE es."segmentId" = fs."segmentId" AND es."elementCategoryId" = fs."elementCategoryId"
  );
