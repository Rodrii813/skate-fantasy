-- Fila única de ajustes globales del sitio (de momento, la cuenta atrás de
-- la home). El valor por defecto de "id" hace que un simple
-- prisma.siteSettings.create({ data: {} }) o un upsert con
-- where: { id: "singleton" } siempre apunte a la misma fila.
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "countdownEnabled" BOOLEAN NOT NULL DEFAULT false,
    "countdownTitle" TEXT,
    "countdownLocation" TEXT,
    "countdownTargetDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
