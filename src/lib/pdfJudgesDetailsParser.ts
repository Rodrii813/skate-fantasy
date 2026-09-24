export interface ElementExecution {
  type: "COMBO_JUMP" | "SOLO_JUMP" | "AXEL" | "SPIN" | "STEP" | "CHOREO";
  name: string;
  score: number;
}

export interface SkaterDetailedResult {
  rank: number;
  fullName: string;
  nation?: string;
  tes: number;
  pcs: number;
  deductions: number;
  segmentScore: number;
  elements: ElementExecution[];
  components: {
    skatingSkills: number;
    transitions: number;
    performance: number;
    choreography: number;
  };
  slotScores: {
    comboJump1: number;
    comboJump2: number;
    soloJump1: number;
    soloJump2: number;
    axel: number;
    spinsTotal: number;
    stepSequence: number;
    choreoSequence: number;
    pcsSkatingTransitions: number;
    pcsPerformanceChoreo: number;
  };
}

export function parseJudgesDetailsText(pdfText: string): SkaterDetailedResult[] {
  const results: SkaterDetailedResult[] = [];

  // Normalizar saltos de línea y espacios
  const cleanText = pdfText.replace(/\r\n/g, "\n");

  // Localizar todas las fichas individuales de "JUDGES DETAILS PER SKATER"
  const skaterChunks = cleanText.split(/JUDGES DETAILS PER SKATER/i);

  // Descartamos la cabecera previa a la primera ficha
  for (let idx = 1; idx < skaterChunks.length; idx++) {
    const chunk = skaterChunks[idx];

    // 1. Extraer Rank (ej: Rank \n 1 o Rank 1)
    const rankMatch = chunk.match(/Rank\s*(\d+)/i) || chunk.match(/(?:^|\n)\s*(\d+)\s*\n\s*(?:Name|[A-ZÁÉÍÓÚÑ\s]{4,})/);
    const rank = rankMatch ? parseInt(rankMatch[1], 10) : idx;

    // 2. Extraer Nombre del Patinador
    let fullName = "";
    // Patrón 1: Name seguido del nombre en la siguiente línea o misma línea
    const nameMatch = chunk.match(/Name\s*\n\s*([A-ZÁÉÍÓÚÑ\s'-]{4,})/i) || 
                      chunk.match(/Name\s+([A-ZÁÉÍÓÚÑ\s'-]{4,})/i);

    if (nameMatch) {
      fullName = nameMatch[1].trim();
    } else {
      // Patrón 2: buscar la línea en mayúsculas después de Rank
      const lines = chunk.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines.slice(0, 15)) {
        if (
          /^[A-ZÁÉÍÓÚÑ\s'-]{5,}$/.test(line) &&
          !line.includes("TOTAL") &&
          !line.includes("ELEMENT") &&
          !line.includes("SCORE") &&
          !line.includes("PROGRAM") &&
          !line.includes("WORLD") &&
          !line.includes("SKATE") &&
          !line.includes("NATION")
        ) {
          fullName = line;
          break;
        }
      }
    }

    if (!fullName) continue;

    // Limpiar posibles residuos en el nombre
    fullName = fullName.replace(/\b(Nation|POR|ESP|ITA|FRA|GER|AND|NED|DEN|SLO)\b/g, "").replace(/\s+/g, " ").trim();

    // 3. Extraer Totales (TES, PCS, Deductions, Segment Score)
    const scoreRowMatch = chunk.match(/(\d+\.\d{2})\s+(\d+\.\d{2})\s+([-\d.]+)\s+(\d+\.\d{2})/);
    const tes = scoreRowMatch ? parseFloat(scoreRowMatch[1]) : 0;
    const pcs = scoreRowMatch ? parseFloat(scoreRowMatch[2]) : 0;
    const deductions = scoreRowMatch ? parseFloat(scoreRowMatch[3]) : 0;
    const segmentScore = scoreRowMatch ? parseFloat(scoreRowMatch[4]) : 0;

    const skaterResult: SkaterDetailedResult = {
      rank,
      fullName,
      tes,
      pcs,
      deductions,
      segmentScore,
      elements: [],
      components: {
        skatingSkills: 0,
        transitions: 0,
        performance: 0,
        choreography: 0,
      },
      slotScores: {
        comboJump1: 0,
        comboJump2: 0,
        soloJump1: 0,
        soloJump2: 0,
        axel: 0,
        spinsTotal: 0,
        stepSequence: 0,
        choreoSequence: 0,
        pcsSkatingTransitions: 0,
        pcsPerformanceChoreo: 0,
      },
    };

    // 4. Extraer Componentes (PCS) buscando la última nota de la fila
    const getPcsValue = (label: string): number => {
      const reg = new RegExp(`${label}[\\s\\S]*?(\\d+\\.\\d{2})\\s*(?:\\n|Judges|Transitions|Performance|Choreography)`, "i");
      const match = chunk.match(reg);
      return match ? parseFloat(match[1]) : 0;
    };

    skaterResult.components.skatingSkills = getPcsValue("Skating Skills");
    skaterResult.components.transitions = getPcsValue("Transitions");
    skaterResult.components.performance = getPcsValue("Performance");
    skaterResult.components.choreography = getPcsValue("Choreography");

    // 5. Extraer Elementos Técnicos por líneas individuales
    const lines = chunk.split("\n").map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detectar ComboJump
      if (line.includes("ComboJump")) {
        const score = extractScoresOfPanel(lines, i);
        if (score > 0) skaterResult.elements.push({ type: "COMBO_JUMP", name: "Combo Jump", score });
      }
      // Detectar Jump individual
      else if (line === "Jump" || line.startsWith("Jump ") || line.endsWith("Jump") || /^\d+\s*Jump/i.test(line)) {
        const block = lines.slice(i, i + 6).join(" ");
        const isAxel = block.includes("Axel") || block.includes("1A") || block.includes("2A") || block.includes("3A");
        const score = extractScoresOfPanel(lines, i);
        if (score > 0) {
          skaterResult.elements.push({
            type: isAxel ? "AXEL" : "SOLO_JUMP",
            name: isAxel ? "Axel" : "Solo Jump",
            score,
          });
        }
      }
      // Detectar Piruetas (ComboSpin o Spin)
      else if (line.includes("ComboSpin") || (line.includes("Spin") && !line.includes("Broken") && !line.includes("No Level"))) {
        const score = extractScoresOfPanel(lines, i);
        if (score > 0) skaterResult.elements.push({ type: "SPIN", name: "Spin", score });
      }
      // Detectar Choreo Sequence (ChSt)
      else if (line.includes("ChSt") || line.includes("Choreo Step")) {
        const score = extractScoresOfPanel(lines, i);
        if (score > 0) skaterResult.elements.push({ type: "CHOREO", name: "Choreo Step", score });
      }
      // Detectar Step Sequence (St)
      else if (line.includes("Step Sequence") || line.includes("St1") || line.includes("StB")) {
        const score = extractScoresOfPanel(lines, i);
        if (score > 0) skaterResult.elements.push({ type: "STEP", name: "Step Sequence", score });
      }
    }

    // 6. Ordenar y asignar a los slots oficiales
    const combos = skaterResult.elements.filter((e) => e.type === "COMBO_JUMP").sort((a, b) => b.score - a.score);
    const solos = skaterResult.elements.filter((e) => e.type === "SOLO_JUMP").sort((a, b) => b.score - a.score);
    const axels = skaterResult.elements.filter((e) => e.type === "AXEL").sort((a, b) => b.score - a.score);
    const spins = skaterResult.elements.filter((e) => e.type === "SPIN");
    const choreos = skaterResult.elements.filter((e) => e.type === "CHOREO");
    const steps = skaterResult.elements.filter((e) => e.type === "STEP");

    skaterResult.slotScores.comboJump1 = combos[0]?.score || 0;
    skaterResult.slotScores.comboJump2 = combos[1]?.score || 0;
    skaterResult.slotScores.soloJump1 = solos[0]?.score || 0;
    skaterResult.slotScores.soloJump2 = solos[1]?.score || 0;
    skaterResult.slotScores.axel = axels[0]?.score || 0;
    skaterResult.slotScores.spinsTotal = Number(spins.reduce((acc, curr) => acc + curr.score, 0).toFixed(2));
    skaterResult.slotScores.choreoSequence = choreos[0]?.score || 0;
    skaterResult.slotScores.stepSequence = steps[0]?.score || 0;

    // Sumar Componentes agrupados
    skaterResult.slotScores.pcsSkatingTransitions = Number(
      (skaterResult.components.skatingSkills + skaterResult.components.transitions).toFixed(2)
    );
    skaterResult.slotScores.pcsPerformanceChoreo = Number(
      (skaterResult.components.performance + skaterResult.components.choreography).toFixed(2)
    );

    results.push(skaterResult);
  }

  return results;
}

// Helper para extraer la nota de panel (Scores of Panel)
function extractScoresOfPanel(lines: string[], startIdx: number): number {
  for (let k = 1; k <= 15; k++) {
    const candidate = lines[startIdx + k];
    if (!candidate) break;
    // Si llegamos a otro elemento, paramos
    if (k > 1 && (candidate.includes("Combo") || candidate.includes("Jump") || candidate.includes("Sequence") || candidate.includes("Program Components"))) {
      break;
    }
    const val = parseFloat(candidate);
    // Un elemento puntúa habitualmente entre 0.01 y 30.00
    if (!isNaN(val) && val > 0 && candidate.includes(".") && candidate.length <= 6) {
      return val;
    }
  }
  return 0;
}