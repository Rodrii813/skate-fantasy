-- Registro de avisos automáticos ya enviados (evita mandar el mismo dos veces).
CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("key")
);
