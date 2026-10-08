-- Orden de salida propio del Largo. Hasta ahora startOrder era único por
-- inscripción, así que importar el orden del Largo pisaba el del Corto.
-- startOrder pasa a ser el del Corto (o el único); el Largo usa
-- startOrderLong. Nulo = el Largo usa startOrder (datos anteriores).
ALTER TABLE "Registration" ADD COLUMN "startOrderLong" INTEGER;
