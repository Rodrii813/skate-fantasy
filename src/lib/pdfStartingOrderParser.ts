export interface ParsedSkaterOrder {
  startOrder: number;
  warmupGroup: number;
  fullName: string;
  firstName: string;
  lastName: string;
  country: string; // "ESP", "ITA", "POR", etc.
  club?: string;
}

export function parseStartingOrderText(pdfText: string): ParsedSkaterOrder[] {
  // Comprobamos si el PDF tiene la estructura de World Skate o de la RFEP
  if (/warm\s*up\s*group/i.test(pdfText)) {
    return parseWorldSkateFormat(pdfText);
  } else {
    return parseRFEPFormat(pdfText);
  }
}

// 1. FORMATO WORLD SKATE (Europeo y Mundial)
function parseWorldSkateFormat(text: string): ParsedSkaterOrder[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedSkaterOrder[] = [];
  let currentGroup = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar grupo con o sin asteriscos (ej. "******** Warm Up Group 1********")[cite: 6]
    const groupMatch = line.match(/warm\s*up\s*group\s*(\d+)/i);
    if (groupMatch) {
      currentGroup = parseInt(groupMatch[1], 10);
      continue;
    }

    // Detectar país al final de la línea o línea que es solo el país (ej: "SUI", "FRA", "ESP")[cite: 6]
    const countryMatch = line.match(/\b([A-Z]{3})$/);

    if (countryMatch) {
      const country = countryMatch[1];
      let fullName = "";
      let startOrder = results.length + 1;

      // Caso A: El nombre está en la misma línea
      let cleaned = line
        .replace(/\b[A-Z]{3}$/, "")
        .replace(/\d{2}:\d{2}/g, "")
        .trim();

      const orderMatch = cleaned.match(/^(\d{1,2})\b/);
      if (orderMatch) {
        startOrder = parseInt(orderMatch[1], 10);
        cleaned = cleaned.replace(/^(\d{1,2})\s*/, "").trim();
      }

      const inlineName = cleaned.match(/[A-ZÁÉÍÓÚÑÇÀÈÌÒÙÏÜ\s'-]{3,}/i);
      if (inlineName && inlineName[0].trim().length > 2) {
        fullName = inlineName[0].trim();
      } else if (i > 0) {
        // Caso B: El nombre estaba en la línea anterior (común en este PDF)[cite: 6]
        const prev = lines[i - 1]
          .replace(/\d{2}:\d{2}/g, "")
          .replace(/^(\d{1,2})\s*/, "")
          .trim();
        if (prev.length > 2 && !/TIME|ORDER|PROGRAM/i.test(prev)) {
          fullName = prev;
        }
      }

      if (
        fullName &&
        fullName.length > 2 &&
        !/TIME|ORDER|PROGRAM|WORLD|SKATE|NATION/i.test(fullName)
      ) {
        const { firstName, lastName } = splitSkaterName(fullName);
        results.push({
          startOrder,
          warmupGroup: currentGroup,
          fullName,
          firstName,
          lastName,
          country,
        });
      }
    }
  }

  return results;
}

// 2. FORMATO RFEP (Campeonatos de España)
function parseRFEPFormat(text: string): ParsedSkaterOrder[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.includes("FINAL GRUPO"));

  const results: ParsedSkaterOrder[] = [];
  // Expresión para: Ord (1-2 dígitos) | GS (1-2 dígitos) | Nombre (FEDERACIÓN)
  const rowRegex = /^(\d{1,2})\s+(\d{1,2})\s+([A-ZÁÉÍÓÚÑ\s]+)\s*\(([^)]+)\)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(rowRegex);

    if (match) {
      const startOrder = parseInt(match[1], 10);
      const warmupGroup = parseInt(match[2], 10);
      const fullName = match[3].trim();

      let club = "";
      if (i + 1 < lines.length && !lines[i + 1].match(/^\d{1,2}\s+\d{1,2}/)) {
        club = lines[i + 1];
      }

      const { firstName, lastName } = splitSkaterName(fullName);

      results.push({
        startOrder,
        warmupGroup,
        fullName,
        firstName,
        lastName,
        country: "ESP",
        club,
      });
    }
  }

  return results;
}

// Separación de Nombre y Apellidos
function splitSkaterName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);
  let firstName = parts[0] || "";
  let lastName = parts.slice(1).join(" ") || "";

  if (parts.length > 2 && ["MARIA", "JUAN", "JOSE", "ANA", "JOAN", "CALI"].includes(parts[0])) {
    firstName = `${parts[0]} ${parts[1]}`;
    lastName = parts.slice(2).join(" ");
  }

  return { firstName, lastName };
}