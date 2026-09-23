# Skate Fantasy — World Skate Games

Fantasy no oficial de patinaje artístico: para cada evento (disciplina +
categoría dentro de una competición), el usuario elige un patinador distinto
para cada "slot" (p. ej. mejor salto, mejor giro combinado, componentes del
programa...). Tras la competición, un admin introduce a mano la puntuación
oficial de cada patinador por segmento y tipo de elemento (tal como viene en
el protocolo de World Skate, que no tiene API pública). La puntuación fantasy
de cada usuario es la suma de las puntuaciones reales de los patinadores que
eligió, y con eso se calcula el ranking por evento y el ranking global.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** vía **Prisma**
- **NextAuth** (login por email/contraseña) — pensado para uso público
- **Tailwind CSS**

## Puesta en marcha en local

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y rellena `DATABASE_URL` con una base de
   datos Postgres. La más rápida para empezar gratis:
   - [Neon](https://neon.tech) o [Supabase](https://supabase.com) — crea un
     proyecto, copia la cadena de conexión.
3. Genera `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
4. Crea las tablas y carga datos de ejemplo:
   ```bash
   npm run db:push
   npm run db:seed
   ```
   Esto crea un usuario admin (`admin@skatefantasy.local`, contraseña la que
   pongas en `SEED_ADMIN_PASSWORD`) y una competición/evento de ejemplo con 3
   patinadoras y 3 slots, para que puedas probar el flujo completo enseguida.
5. Arranca el servidor:
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

## Cómo se gestiona el contenido (competiciones, patinadores, eventos)

Esto es lo importante para el día a día:

- **Catálogo y alta de datos** (disciplinas, categorías de edad, categorías
  de elemento, competiciones, eventos, segmentos, patinadores, inscripciones,
  slots de fantasy): usa **Prisma Studio**, un editor de tablas visual
  incluido gratis:
  ```bash
  npm run db:studio
  ```
  Así no hay que construir ni mantener un CRUD a medida para cada tabla.
  Recomiendo dar de alta las cosas en este orden: `Discipline` / `Category` /
  `ElementCategory` (catálogo, casi no cambia) → `Competition` → `Event` →
  `Segment` (programa corto/libre...) → `FantasySlot` (qué debe elegir el
  usuario, apuntando a un segmento + categoría de elemento) → `Skater` →
  `Registration` (qué patinadores compiten en ese evento).

- **Carga de resultados tras la competición** (lo que se hace cada semana,
  con volumen): tiene su propia pantalla optimizada en
  `/admin/results/[eventId]`, con una tabla patinador × elemento donde vas
  tecleando puntuaciones y se guardan solas al salir del campo (sin botón de
  guardar por fila).

## Modelo de datos (resumen)

```
Discipline, Category, ElementCategory   → catálogo global, editable
Competition → Event → Segment            → estructura de una competición real
Event → FantasySlot                      → qué debe elegir el usuario
Skater → Registration                    → quién compite en cada evento
Registration → ElementScore              → puntuación oficial real (a mano)
User → FantasyRoster → FantasyPick       → el equipo fantasy de cada usuario
```

El cálculo de puntos vive en `src/lib/scoring.ts`: por cada pick, busca la
`ElementScore` del patinador elegido que coincide en categoría de elemento y
segmento con el slot, y sopesa 0 si el admin aún no la ha cargado.

## Desplegar en producción (Vercel)

1. Sube este proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com), "New Project" → importa el repo.
3. Añade las variables de entorno (`DATABASE_URL`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL` con tu dominio de Vercel).
4. Despliega. Después, desde tu máquina, apunta `DATABASE_URL` a la misma
   base de datos de producción y ejecuta `npm run db:push` y (si quieres)
   `npm run db:seed` una vez.

## Qué falta / próximos pasos sugeridos

Esto es un esqueleto funcional y desplegable, no un producto terminado.
Ideas para seguir construyendo (yo puedo ayudarte con cualquiera de ellas):

- Página de perfil de patinador con histórico de puntuaciones.
- Recordatorios / countdown visual del cierre de picks.
- Ligas privadas dentro del ranking público (grupos de amigos).
- Importador semi-automático desde el PDF de protocolos oficiales de World
  Skate, para no teclear cada puntuación a mano.
- Roles de "moderador" por disciplina, para repartir la carga de resultados.
