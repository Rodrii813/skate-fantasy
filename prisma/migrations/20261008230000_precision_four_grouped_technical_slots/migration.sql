-- Precisión: los 8 slots técnicos pasan a 4 slots agrupados de 2 en 2
-- (cada uno puntúa la suma de sus dos elementos):
--   Rotating Wheel + Linear Line, Pivoting Block + Move Element,
--   Intersection + Traveling, Creative + No Hold Element.
--
-- Solo se transforman los eventos de Precisión SIN ningún draft guardado en
-- sus slots técnicos y SIN puntuaciones cargadas en ellos; cualquier evento con
-- drafts o resultados se deja exactamente como está. Es idempotente: tras
-- aplicarse, los slots ya no tienen los nombres antiguos y no vuelve a tocar nada.
INSERT INTO "ElementCategory" ("id", "name", "slug")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || v.slug), 1, 24), v.name, v.slug
FROM (VALUES
  ('Rotating Wheel + Linear Line', 'rotating-wheel-linear-line'),
  ('Pivoting Block + Move Element', 'pivoting-block-move-element'),
  ('Intersection + Traveling', 'intersection-traveling'),
  ('Creative + No Hold Element', 'creative-no-hold-element')
) AS v(name, slug)
WHERE NOT EXISTS (
  SELECT 1 FROM "ElementCategory" c WHERE c."name" = v.name OR c."slug" = v.slug
);

CREATE TEMP TABLE _precision_eligible AS
SELECT e."id" AS event_id
FROM "Event" e
JOIN "Discipline" d ON d."id" = e."disciplineId"
WHERE d."slug" = 'precision'
  AND EXISTS (
    SELECT 1 FROM "FantasySlot" s WHERE s."eventId" = e."id" AND s."label" = 'Rotating Wheel'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "FantasyPick" p
    JOIN "FantasySlot" s ON s."id" = p."slotId"
    WHERE s."eventId" = e."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ElementScore" es
    JOIN "FantasySlot" s ON s."segmentId" = es."segmentId" AND s."elementCategoryId" = es."elementCategoryId"
    WHERE s."eventId" = e."id"
  );

-- El primer slot de cada pareja se renombra en su sitio...
UPDATE "FantasySlot" fs
SET "label" = m.new_label,
    "elementCategoryId" = (SELECT c."id" FROM "ElementCategory" c WHERE c."name" = m.new_label)
FROM (VALUES
  ('Rotating Wheel', 'Rotating Wheel + Linear Line'),
  ('Pivoting Block', 'Pivoting Block + Move Element'),
  ('Intersection', 'Intersection + Traveling'),
  ('Creative', 'Creative + No Hold Element')
) AS m(old_label, new_label)
WHERE fs."eventId" IN (SELECT event_id FROM _precision_eligible)
  AND fs."label" = m.old_label;

-- ...y el segundo se elimina (no tiene drafts ni puntuaciones).
DELETE FROM "FantasySlot" fs
WHERE fs."eventId" IN (SELECT event_id FROM _precision_eligible)
  AND fs."label" IN ('Linear Line', 'Move Element', 'Traveling', 'No Hold Element');

-- Reordena 1..6 (4 técnicos + 2 componentes) respetando el orden existente.
UPDATE "FantasySlot" fs
SET "order" = r.rn
FROM (
  SELECT s."id", row_number() OVER (PARTITION BY s."eventId", s."segmentId" ORDER BY s."order", s."id") AS rn
  FROM "FantasySlot" s
  WHERE s."eventId" IN (SELECT event_id FROM _precision_eligible)
) r
WHERE fs."id" = r."id";

DROP TABLE _precision_eligible;
