-- Marca eventos de práctica (Fantasy/Predicciones "de mentira", creados
-- antes de tener órdenes de salida reales) para poder avisar de ello en la
-- interfaz pública sin confundirlos con una prueba real.
ALTER TABLE "Event" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
