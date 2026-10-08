-- Desglose completo del acta por patinador y segmento (solo para mostrar).
CREATE TABLE IF NOT EXISTS "SegmentDetail" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentDetail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SegmentDetail_registrationId_segmentId_key"
    ON "SegmentDetail"("registrationId", "segmentId");

ALTER TABLE "SegmentDetail" ADD CONSTRAINT "SegmentDetail_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SegmentDetail" ADD CONSTRAINT "SegmentDetail_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
