-- Apertura propia de Predicciones por evento (hora programada + override
-- manual), igual que ya tenía el draft por segmento. Eventos existentes:
-- sin hora propia y sin apertura manual, así que siguen abiertos en cuanto
-- tienen patinadores inscritos.
ALTER TABLE "Event" ADD COLUMN "predictionsOpensAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "predictionsManuallyOpened" BOOLEAN NOT NULL DEFAULT false;
