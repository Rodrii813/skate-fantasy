-- Anuncio de la home: aviso de texto libre, activable/desactivable desde
-- /admin/settings, para cosas puntuales (p.ej. "todavía no hay órdenes de
-- salida") sin tener que tocar código ni esperar un despliegue para
-- quitarlo cuando deje de aplicar.
ALTER TABLE "SiteSettings" ADD COLUMN "announcementEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteSettings" ADD COLUMN "announcementText" TEXT;
