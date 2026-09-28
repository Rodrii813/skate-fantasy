-- AlterTable
ALTER TABLE "LeagueMembership" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Quien ya creó una liga pasa a tener isAdmin=true en su propia membership,
-- para que el creador cuente también como administrador (coherente con lo
-- que hará prisma.league.create a partir de ahora para ligas nuevas).
UPDATE "LeagueMembership" m
SET "isAdmin" = true
FROM "League" l
WHERE m."leagueId" = l."id" AND m."userId" = l."ownerId";
