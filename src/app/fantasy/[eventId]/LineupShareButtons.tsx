"use client";

import { useState } from "react";
import logoMark from "@/app/_components/logo-mark.png";

// Compartir la alineación GUARDADA de un segmento: imagen vertical (1080x1920,
// formato stories/estado de WhatsApp) dibujada en un <canvas> —sin librerías ni
// servidor— más un enlace directo al formulario de esa prueba para que quien
// la vea pueda elegir su propio equipo. En móvil abre el menú de compartir del
// sistema (WhatsApp, Instagram...) con la imagen y el enlace; en ordenador
// descarga el PNG, y hay botones aparte para WhatsApp y para copiar el enlace.

export interface LineupRow {
  label: string;
  skaterName: string;
  country: string;
  isComponent: boolean;
}

export interface LineupImageText {
  title: string;
  technical: string;
  components: string;
}

export interface LineupShareLabels extends LineupImageText {
  share: string;
  working: string;
  whatsapp: string;
  copyLink: string;
  copied: string;
  downloaded: string;
  error: string;
  shareText: (url: string) => string;
}

const W = 1080;
const H = 1920;
const PAD = 80;
const BG = "#0a1f33";
const GOLD = "#c9a227";
const TEAL = "#2fb6a3";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Parte un texto en como mucho `maxLines` líneas que quepan en `maxWidth`,
// reduciendo la fuente si no cabe ni así. Devuelve las líneas y el tamaño usado.
function wrapFit(
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawLineup(
  canvas: HTMLCanvasElement,
  p: { eventName: string; segmentName: string; rows: LineupRow[]; text: LineupImageText },
  logo: HTMLImageElement | null,
  flags: Map<string, HTMLImageElement> = new Map()
) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // Fondo liso
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Logo arriba a la derecha
  const logoSize = 190;
  if (logo) ctx.drawImage(logo, W - PAD - logoSize, 70, logoSize, logoSize);

  // Cabecera: título, prueba (hasta 2 líneas, sin cortar) y segmento
  const headW = W - PAD * 2 - logoSize - 30;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${fitPx(ctx, p.text.title, headW, 900, 84, 44)}px ${FONT}`;
  ctx.fillText(p.text.title, PAD, 150);
  const ev = wrapFit(ctx, p.eventName, headW, 800, 44, 28, 2);
  ctx.fillStyle = GOLD;
  ctx.font = `800 ${ev.px}px ${FONT}`;
  let hy = 150 + 62;
  ev.lines.forEach((line) => {
    ctx.fillText(line, PAD, hy);
    hy += ev.px + 10;
  });
  ctx.fillStyle = "rgba(226,237,245,0.7)";
  ctx.font = `600 ${fitPx(ctx, p.segmentName, headW, 600, 34, 22)}px ${FONT}`;
  ctx.fillText(p.segmentName, PAD, hy + 6);

  // Listas: técnicos y componentes
  const tech = p.rows.filter((r) => !r.isComponent);
  const comp = p.rows.filter((r) => r.isComponent);
  const sections = [
    { title: p.text.technical, color: GOLD, rows: tech },
    { title: p.text.components, color: TEAL, rows: comp },
  ].filter((s) => s.rows.length > 0);

  const top = Math.max(360, hy + 80);
  const bottom = H - 230;
  const headingH = 70;
  const sectionGap = 40;
  const nRows = Math.max(1, tech.length + comp.length);
  const avail = bottom - top - sections.length * headingH - Math.max(0, sections.length - 1) * sectionGap;
  const rowH = Math.min(132, avail / nRows);
  const boxH = Math.min(78, rowH * 0.6);
  const maxW = W - PAD * 2;

  let y = top;
  sections.forEach((section, si) => {
    if (si > 0) y += sectionGap;
    ctx.fillStyle = section.color;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(section.title, PAD, y + 36);
    y += headingH;
    section.rows.forEach((row) => {
      // Etiqueta del elemento
      ctx.fillStyle = "rgba(226,237,245,0.75)";
      ctx.font = `600 ${fitPx(ctx, row.label, maxW, 600, 27, 18)}px ${FONT}`;
      ctx.fillText(row.label, PAD, y + 26);

      // Casilla pequeña con bandera + nombre + país reducido
      const boxY = y + 38;
      roundRect(ctx, PAD, boxY, maxW, boxH, 16);
      ctx.fillStyle = "#10304b";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = section.color === GOLD ? "rgba(201,162,39,0.55)" : "rgba(47,182,163,0.55)";
      ctx.stroke();

      let x = PAD + 22;
      const flag = flags.get(row.country.trim().toUpperCase());
      if (flag) {
        const fh = Math.min(40, boxH * 0.55);
        const fw = fh * (4 / 3);
        const fy = boxY + (boxH - fh) / 2;
        ctx.save();
        roundRect(ctx, x, fy, fw, fh, 5);
        ctx.clip();
        ctx.drawImage(flag, x, fy, fw, fh);
        ctx.restore();
        x += fw + 18;
      }
      const textMax = PAD + maxW - 22 - x;
      const codePx = 26;
      ctx.font = `600 ${codePx}px ${FONT}`;
      const codeText = row.country ? `(${row.country})` : "";
      const codeW = codeText ? ctx.measureText(codeText).width + 12 : 0;
      ctx.fillStyle = "#ffffff";
      const namePx = fitPx(ctx, row.skaterName, textMax - codeW, 700, Math.min(40, boxH * 0.52), 22);
      ctx.font = `700 ${namePx}px ${FONT}`;
      const base = boxY + boxH / 2 + namePx * 0.34;
      ctx.fillText(row.skaterName, x, base);
      if (codeText) {
        const nameW = ctx.measureText(row.skaterName).width;
        ctx.fillStyle = "rgba(226,237,245,0.55)";
        ctx.font = `600 ${codePx}px ${FONT}`;
        ctx.fillText(codeText, x + nameW + 12, base);
      }
      y += rowH;
    });
  });

  // Pie: web y redes
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText("rollartfantasy.com", PAD, H - 130);
  ctx.fillStyle = "rgba(226,237,245,0.7)";
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText("Instagram · X  @rollartfantasy", PAD, H - 75);
}

// Mayor tamaño de fuente (entre min y start) con el que `text` cabe en maxWidth.
function fitPx(
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Banderas de los países que aparecen en la lista (solo se cargan las
// necesarias; el módulo con todas se importa de forma dinámica).
async function loadFlags(rows: LineupRow[]): Promise<Map<string, HTMLImageElement>> {
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

export default function LineupShareButtons({
  eventId,
  segmentId,
  eventName,
  segmentName,
  rows,
  labels,
}: {
  eventId: string;
  segmentId: string | null;
  eventName: string;
  segmentName: string;
  rows: LineupRow[];
  labels: LineupShareLabels;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const linkUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://rollartfantasy.com";
    return `${origin}/events/${eventId}${segmentId ? `?segment=${segmentId}` : ""}`;
  };

  const flash = (text: string, error = false) => {
    setNote({ text, error });
    setTimeout(() => setNote(null), 3500);
  };

  const handleShare = async () => {
    setBusy(true);
    setNote(null);
    try {
      const [logo, flags] = await Promise.all([loadImage(logoMark.src), loadFlags(rows)]);
      const canvas = document.createElement("canvas");
      drawLineup(canvas, { eventName, segmentName, rows, text: labels }, logo, flags);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no blob");
      const slug = `rollart-fantasy-${eventName}-${segmentName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const file = new File([blob], `${slug}.png`, { type: "image/png" });
      const url = linkUrl();
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: labels.shareText(url) });
          return;
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
        }
      }
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(file);
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      flash(labels.downloaded);
    } catch {
      flash(labels.error, true);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl());
      flash(labels.copied);
    } catch {
      flash(labels.error, true);
    }
  };

  const btn =
    "py-2.5 rounded-xl text-xs font-bold border transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        className={`w-full ${btn} bg-gold/15 hover:bg-gold/25 text-gold border-gold/40`}
      >
        {busy ? labels.working : labels.share}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(labels.shareText(linkUrl()))}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // el href se calcula al renderizar; se recalcula al pulsar por si
            // cambió el segmento activo
            (e.currentTarget as HTMLAnchorElement).href = `https://wa.me/?text=${encodeURIComponent(
              labels.shareText(linkUrl())
            )}`;
          }}
          className={`text-center ${btn} bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border-emerald-500/40`}
        >
          {labels.whatsapp}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700`}
        >
          {labels.copyLink}
        </button>
      </div>
      {note && (
        <p className={`text-center text-[11px] ${note.error ? "text-red-400" : "text-emerald-400"}`}>{note.text}</p>
      )}
    </div>
  );
}
