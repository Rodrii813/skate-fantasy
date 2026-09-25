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
    // El Axel es obligatorio tanto en Corto como en Largo, pero con una
    // diferencia real de reglamento: en el Corto va en posición fija y tiene
    // su propio slot en Fantasy (ver `axel` arriba); en el Largo puede ir en
    // cualquier momento del programa y cuenta simplemente como "un salto
    // individual más" — por eso aquí se mezcla con el resto de saltos
    // individuales (soloJump) y se ordenan juntos de mayor a menor, para
    // rellenar los slots "Solo Jump 1"/"Solo Jump 2" del Largo.
    soloOrAxel1: number;
    soloOrAxel2: number;
    spinsTotal: number;
    stepSequence: number;
    choreoSequence: number;
    pcsSkatingTransitions: number;
    pcsPerformanceChoreo: number;
  };
}

function keywordToType(keyword: string, nearbyText: string): ElementExecution["type"] {
  if (keyword === "ComboJump") return "COMBO_JUMP";
  if (keyword === "Jump") return nearbyText.includes("Axel") ? "AXEL" : "SOLO_JUMP";
  if (keyword === "ComboSpin" || keyword === "Spin") return "SPIN";
  if (keyword === "Step Sequence") return "STEP";
  return "CHOREO";
}

export function parseJudgesDetailsText(pdfText: string): SkaterDetailedResult[] {
  const results: SkaterDetailedResult[] = [];
  const cleanText = pdfText.replace(/\r\n/g, "\n");
  const skaterChunks = cleanText.split(/JUDGES DETAILS PER SKATER/i);

  for (let idx = 1; idx < skaterChunks.length; idx++) {
    const chunk = skaterChunks[idx];
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

    // El nombre del patinador es siempre la primera línea no vacía tras el
    // separador "JUDGES DETAILS PER SKATER" en el formato real de World
    // Skate (antes se buscaba con un regex "Name\n..." que no existe en
    // este PDF, y por eso capturaba la cabecera de la tabla, "Total
    // Element score", en vez del nombre real).
    let fullName = lines[0] || "";
    fullName = fullName.replace(/\s+/g, " ").trim();
    if (!fullName || /^(rank|name|total|nation)\b/i.test(fullName)) continue;

    // Fila de totales real: "<rank> <NAT>\n<TES> <PCS> <DED> <TOTAL>"
    const totalsMatch = chunk.match(
      /(\d+)\s+([A-Z]{3})\s*\n?\s*(\d+\.\d{2})\s+(\d+\.\d{2})\s+([-\d.]+)\s+(\d+\.\d{2})/
    );

    const rank = totalsMatch ? parseInt(totalsMatch[1], 10) : idx;
    const nation = totalsMatch ? totalsMatch[2] : undefined;
    const tes = totalsMatch ? parseFloat(totalsMatch[3]) : 0;
    const pcs = totalsMatch ? parseFloat(totalsMatch[4]) : 0;
    const deductions = totalsMatch ? parseFloat(totalsMatch[5]) : 0;
    const segmentScore = totalsMatch ? parseFloat(totalsMatch[6]) : 0;

    const skaterResult: SkaterDetailedResult = {
      rank,
      fullName,
      nation,
      tes,
      pcs,
      deductions,
      segmentScore,
      elements: [],
      components: { skatingSkills: 0, transitions: 0, performance: 0, choreography: 0 },
      slotScores: {
        comboJump1: 0,
        comboJump2: 0,
        soloJump1: 0,
        soloJump2: 0,
        axel: 0,
        soloOrAxel1: 0,
        soloOrAxel2: 0,
        spinsTotal: 0,
        stepSequence: 0,
        choreoSequence: 0,
        pcsSkatingTransitions: 0,
        pcsPerformanceChoreo: 0,
      },
    };

    // Componentes (PCS): en el PDF real cada fila es
    // "<Label> <J1> <J2> <J3> <J4> <J5> <promedio><Factor>", y el Factor
    // (1.6, 1.8, 1.0, 0.8...) varía según disciplina/categoría/segmento —
    // por eso se lee siempre del propio PDF en vez de asumir un valor fijo,
    // y se aplica aquí para devolver el componente YA facturado (el mismo
    // número que suma al "Judges Total Program Component Score (factored)"
    // oficial), no el promedio sin facturar.
    //
    // OJO: en el Programa Largo (Free Program) de World Skate, el texto del
    // Factor se extrae PEGADO al promedio sin ningún espacio de por medio
    // ("6.751.6"), aunque visualmente están en columnas separadas — es un
    // artefacto de cómo ese PDF concreto ordena el texto internamente.
    // Antes el regex exigía que tras el promedio solo pudiera venir UN
    // dígito suelto y luego fin de línea, así que esa fila entera no hacía
    // match y el componente se quedaba en 0 (bug real, reportado con el
    // acta de "Seniores_Free_Skating_Ladies_FINAL_1.pdf": los 4 componentes
    // salían en blanco solo en el Largo, nunca en el Corto). Ahora se
    // captura el Factor aparte (pegado o con espacio) y se multiplica.
    const getPcsValue = (label: string): number => {
      const reg = new RegExp(
        `${label}\\s+\\d+\\.\\d{2}\\s+\\d+\\.\\d{2}\\s+\\d+\\.\\d{2}\\s+\\d+\\.\\d{2}\\s+\\d+\\.\\d{2}\\s+(\\d+\\.\\d{2})\\s*(\\d+(?:\\.\\d+)?)?\\s*$`,
        "im"
      );
      const match = chunk.match(reg);
      if (!match) return 0;
      const average = parseFloat(match[1]);
      const factor = match[2] ? parseFloat(match[2]) : 1;
      return Number((average * factor).toFixed(2));
    };
    skaterResult.components.skatingSkills = getPcsValue("Skating Skills");
    skaterResult.components.transitions = getPcsValue("Transitions/Linking Footwork/Movement");
    skaterResult.components.performance = getPcsValue("Performance/Execution");
    skaterResult.components.choreography = getPcsValue("Choreography/Composition");

    const elementsSectionEnd = chunk.search(/Total\s*\n\s*Segment\s*\n\s*score|Program Components/i);
    const elementsText = elementsSectionEnd > -1 ? chunk.slice(0, elementsSectionEnd) : chunk;

    // Cada elemento técnico empieza con una línea del tipo
    // "<base> <final>ComboJump1 3 Flip3F +1+1+1+1+11.00" y, cuando el
    // elemento tiene varias piezas (p.ej. un ComboSpin con 4 posturas), las
    // líneas siguientes también son pares "<base> <final>" que hay que
    // sumar al mismo elemento hasta la siguiente declaración.
    //
    // Los regex van anclados al INICIO DE LÍNEA ('m'): los pares base/final
    // reales siempre abren su línea en este formato. Sin el anclaje, las
    // marcas de jueces pegadas al final de una línea ("+1+1+1+1+11.00")
    // pueden "empalmar" con el número del inicio de la línea siguiente y
    // formar un número falso que contamina el elemento equivocado.
    const declRegexA =
      /^(\d+\.\d{2})\s+(\d+\.\d{2})(ComboJump|Jump|ComboSpin|Spin|Step Sequence|Choreo Sequence|Choreo Step)(\d+)/gm;
    const declRegexB = /(ComboJump|Jump|ComboSpin|Spin|Step Sequence|Choreo Sequence|Choreo Step)(\d+)/g;
    const pairRegex = /^(\d+\.\d{2})\s+(\d+\.\d{2})/gm;

    type Ev =
      | { pos: number; kind: "decl"; category: string; hasOwnScore: boolean; final?: number; matchLen: number }
      | { pos: number; kind: "pair"; final: number; matchLen: number };

    const events: Ev[] = [];

    for (const m of elementsText.matchAll(declRegexA)) {
      events.push({
        pos: m.index!,
        kind: "decl",
        category: m[3],
        hasOwnScore: true,
        final: parseFloat(m[2]),
        matchLen: m[0].length,
      });
    }
    for (const m of elementsText.matchAll(declRegexB)) {
      const alreadyCovered = events.some(
        (e) => e.kind === "decl" && e.pos <= m.index! && m.index! < e.pos + e.matchLen
      );
      if (alreadyCovered) continue;
      events.push({ pos: m.index!, kind: "decl", category: m[1], hasOwnScore: false, matchLen: m[0].length });
    }
    for (const m of elementsText.matchAll(pairRegex)) {
      const coveredByDecl = events.some((e) => e.kind === "decl" && e.hasOwnScore && e.pos === m.index!);
      if (coveredByDecl) continue;
      events.push({ pos: m.index!, kind: "pair", final: parseFloat(m[2]), matchLen: m[0].length });
    }

    events.sort((a, b) => a.pos - b.pos);

    let currentCategory: string | null = null;
    let currentSum = 0;
    let currentStartPos = 0;

    const flush = () => {
      if (currentCategory !== null) {
        // Para decidir si un "Jump" es un Axel, solo miramos su MISMA
        // línea (hasta el siguiente salto de línea): una ventana de
        // longitud fija podía colarse en la línea del elemento siguiente
        // y clasificar mal un salto normal como Axel.
        const lineEnd = elementsText.indexOf("\n", currentStartPos);
        const nearby =
          lineEnd > -1 ? elementsText.slice(currentStartPos, lineEnd) : elementsText.slice(currentStartPos);
        const type = keywordToType(currentCategory, nearby);
        skaterResult.elements.push({ type, name: currentCategory, score: Number(currentSum.toFixed(2)) });
      }
    };

    for (const ev of events) {
      if (ev.kind === "decl") {
        flush();
        currentCategory = ev.category;
        currentStartPos = ev.pos;
        currentSum = ev.hasOwnScore ? ev.final! : 0;
      } else if (ev.kind === "pair" && currentCategory !== null) {
        currentSum += ev.final;
      }
    }
    flush();

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
    // El Axel es obligatorio en ambos programas, pero solo en el Corto va en
    // posición fija con su propio slot; en el Largo puede ir en cualquier
    // momento y cuenta como un salto individual más, así que aquí se
    // mezcla con el resto de saltos individuales (solos) y se ordenan
    // juntos de mayor a menor para rellenar "Solo Jump 1"/"Solo Jump 2".
    const solosOrAxels = [...solos, ...axels].sort((a, b) => b.score - a.score);
    skaterResult.slotScores.soloOrAxel1 = solosOrAxels[0]?.score || 0;
    skaterResult.slotScores.soloOrAxel2 = solosOrAxels[1]?.score || 0;
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
