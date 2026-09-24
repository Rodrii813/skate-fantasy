// Backfill de Event.gender a partir del texto libre de Event.name.
//
// Este script NO se ejecuta automáticamente en ningún flujo (build, seed,
// migración). El dueño del proyecto debe revisarlo y correrlo a mano,
// después de aplicar la migración que añade la columna `gender`:
//
//   npx prisma migrate deploy
//   npx tsx prisma/backfill-gender.ts
//
// Solo escribe en eventos cuyo `gender` esté todavía a NULL, así que es
// seguro volver a ejecutarlo (idempotente) y no pisa valores ya
// establecidos a mano desde el panel de admin.
//
// No toca Skater.gender: para patinadores no hay un texto de origen
// fiable del que deducir el género, así que ese campo se deja para
// rellenarlo a mano desde el admin.

import { PrismaClient, Gender } from "@prisma/client";

const prisma = new PrismaClient();

function guessGenderFromName(name: string): Gender | null {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const femalePatterns = [/\bfemenino\b/, /\bfemeninas?\b/, /\bladies\b/, /\bwomen\b/, /\bwomens\b/];
  const malePatterns = [/\bmasculino\b/, /\bmasculinos?\b/, /\bmen\b/, /\bmens\b/];

  if (femalePatterns.some((re) => re.test(normalized))) return "FEMALE";
  if (malePatterns.some((re) => re.test(normalized))) return "MALE";
  return null;
}

async function main() {
  const events = await prisma.event.findMany({
    where: { gender: null },
    select: { id: true, name: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    const guess = guessGenderFromName(event.name);
    if (!guess) {
      skipped++;
      console.log(`⏭️  Sin coincidencia, se deja en null: "${event.name}"`);
      continue;
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { gender: guess },
    });
    updated++;
    console.log(`✅ "${event.name}" → ${guess}`);
  }

  console.log(`\nBackfill completado. ${updated} eventos actualizados, ${skipped} sin coincidencia (quedan en null).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
