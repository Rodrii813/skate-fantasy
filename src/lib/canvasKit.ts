// Utilidades de dibujo en <canvas> para las imágenes que se descargan
// (formato stories 1080x1920). Solo se usan en el navegador.

export const W = 1080;
export const H = 1920;
export const PAD = 80;
export const BG = "#0a1f33";
export const GOLD = "#c9a227";
export const TEAL = "#2fb6a3";
export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Parte un texto en como mucho `maxLines` líneas que quepan en `maxWidth`,
// reduciendo la fuente si no cabe ni así. Devuelve las líneas y el tamaño usado.
export function wrapFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  start: number,
  min: number,
  maxLines: number
): { lines: string[]; px: number } {
  for (let px = start; px >= min; px -= 2) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth || !cur) cur = test;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { lines, px };
  }
  return { lines: [text], px: min };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Mayor tamaño de fuente (entre min y start) con el que `text` cabe en maxWidth.
export function fitPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  start: number,
  min: number
): number {
  let px = start;
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && px > min) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${FONT}`;
  }
  return px;
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Banderas de los países indicados (código IOC), como imágenes ya cargadas.
// El módulo con todas las banderas se importa de forma dinámica y solo se
// cargan las necesarias.
export async function loadFlags(rows: { country: string }[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  try {
    const [{ FLAG_PNG }, { IOC_TO_ISO2 }] = await Promise.all([import("@/lib/flagImages"), import("@/lib/iocCountries")]);
    const codes = Array.from(new Set(rows.map((r) => r.country.trim().toUpperCase()).filter(Boolean)));
    await Promise.all(
      codes.map(async (code) => {
        const iso = IOC_TO_ISO2[code];
        const uri = iso ? FLAG_PNG[iso] : undefined;
        if (!uri) return;
        const img = await loadImage(uri);
        if (img) map.set(code, img);
      })
    );
  } catch {
    /* sin banderas: la imagen se genera igual */
  }
  return map;
}
