-- Antes de exigir que el nickname (User.name) sea único, deduplicamos los
-- que ya existan: a todos menos el primero (por antigüedad) se les añade un
-- sufijo numérico, para que el CREATE UNIQUE INDEX de abajo no falle si ya
-- había dos cuentas con el mismo nombre.
WITH ranked AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt", id) AS rn
  FROM "User"
)
UPDATE "User" u
SET name = u.name || ' (' || ranked.rn || ')'
FROM ranked
WHERE u.id = ranked.id AND ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
