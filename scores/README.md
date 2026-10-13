# Rollart Scores — histórico de resultados

Base de datos APARTE de Fantasy (otro proyecto de Neon). No forma parte del
build de la web: nada de esta carpeta se importa desde `src/`.

## Puesta en marcha (una vez)

1. Crea un proyecto nuevo en Neon y copia su cadena de conexión.
2. En PowerShell, desde la raíz del proyecto:

```powershell
$env:SCORES_DATABASE_URL = "postgresql://...tu-cadena-de-neon..."
npx prisma db push --schema scores/schema.prisma
npx prisma generate --schema scores/schema.prisma
```

## Importar actas

Simulación (solo lee, no escribe nada):

```powershell
node --import tsx scores/import-pdf.mjs "C:\ruta\acta1.pdf" "C:\ruta\acta2.pdf" --competition "Nombre de la competición" --season 2026
```

Guardar en la base de datos (añade `--apply`, con la variable de arriba puesta):

```powershell
node --import tsx scores/import-pdf.mjs "C:\ruta\acta1.pdf" --competition "Nombre de la competición" --season 2026 --apply
```

- Un PDF = un segmento (Corto o Largo) de una prueba. Sube los dos para tener la prueba completa.
- Es idempotente: repetir un PDF actualiza, no duplica.
- Los patinadores se reconocen por nombre sin acentos. Al final avisa de los casos dudosos
  (mismo nombre con otro país, o varios con el mismo nombre) para revisarlos.
