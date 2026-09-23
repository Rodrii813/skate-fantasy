import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Catálogo: disciplinas ---
  const disciplineNames = ["Libre", "Parejas", "Solo Danza", "Pareja Danza", "Inline", "Show", "Precisión", "Figuras"];
  const disciplines = await Promise.all(
    disciplineNames.map((name) =>
      prisma.discipline.upsert({
        where: { name },
        create: { name, slug: slugify(name) },
        update: {},
      })
    )
  );

  // --- Catálogo: categorías de edad ---
  const categoryNames = ["Alevín", "Infantil", "Cadete", "Juvenil", "Junior", "Senior"];
  const categories = await Promise.all(
    categoryNames.map((name, i) =>
      prisma.category.upsert({
        where: { name },
        create: { name, slug: slugify(name), order: i },
        update: {},
      })
    )
  );

  // --- Catálogo: categorías de elemento (configurable, ajusta a tu reglamento) ---
  const elementCategoryNames = [
    "Salto individual",
    "Combinación de saltos",
    "Giro combinado",
    "Secuencia de pasos",
    "Secuencia coreográfica",
    "Componentes del programa",
  ];
  const elementCategories = await Promise.all(
    elementCategoryNames.map((name) =>
      prisma.elementCategory.upsert({
        where: { name },
        create: { name, slug: slugify(name) },
        update: {},
      })
    )
  );

  // --- Admin de ejemplo ---
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  await prisma.user.upsert({
    where: { email: "admin@skatefantasy.local" },
    create: {
      name: "Admin",
      email: "admin@skatefantasy.local",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
    update: {},
  });

  // --- Competición + evento de ejemplo ---
  const libre = disciplines.find((d) => d.name === "Libre")!;
  const senior = categories.find((c) => c.name === "Senior")!;

  const competition = await prisma.competition.create({
    data: {
      name: "World Skate Games 2026 (demo)",
      season: "2026",
      location: "Ejemplo",
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-10"),
    },
  });

  const event = await prisma.event.create({
    data: {
      competitionId: competition.id,
      disciplineId: libre.id,
      categoryId: senior.id,
      name: "Libre Senior Femenino (demo)",
      rosterLocksAt: new Date("2026-11-05T09:00:00Z"),
      status: "UPCOMING",
    },
  });

  const programaLibre = await prisma.segment.create({
    data: { eventId: event.id, name: "Programa Libre", order: 1 },
  });

  const ecSalto = elementCategories.find((e) => e.name === "Salto individual")!;
  const ecGiro = elementCategories.find((e) => e.name === "Giro combinado")!;
  const ecComponentes = elementCategories.find((e) => e.name === "Componentes del programa")!;

  await prisma.fantasySlot.createMany({
    data: [
      { eventId: event.id, elementCategoryId: ecSalto.id, segmentId: programaLibre.id, label: "Mejor salto individual", order: 1 },
      { eventId: event.id, elementCategoryId: ecGiro.id, segmentId: programaLibre.id, label: "Mejor giro combinado", order: 2 },
      { eventId: event.id, elementCategoryId: ecComponentes.id, segmentId: programaLibre.id, label: "Componentes del programa", order: 3 },
    ],
  });

  const demoSkaters = [
    { firstName: "Ana", lastName: "Ejemplo", country: "ESP" },
    { firstName: "Marta", lastName: "Prueba", country: "ITA" },
    { firstName: "Sofía", lastName: "Modelo", country: "ARG" },
  ];
  for (const s of demoSkaters) {
    const skater = await prisma.skater.create({
      data: { ...s, disciplineId: libre.id, categoryId: senior.id },
    });
    await prisma.registration.create({ data: { eventId: event.id, skaterId: skater.id } });
  }

  console.log("Seed completado.");
  console.log(`Admin: admin@skatefantasy.local / ${adminPassword}`);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
