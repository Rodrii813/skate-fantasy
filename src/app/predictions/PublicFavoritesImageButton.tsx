"use client";

import { useState } from "react";
import logoMark from "@/app/_components/logo-mark.png";
import { W, H, PAD, BG, GOLD, FONT, wrapFit, roundRect, fitPx, loadImage, loadFlags } from "@/lib/canvasKit";

// Botón SOLO PARA ADMIN (la página no lo renderiza para nadie más): descarga
// una imagen vertical (1080x1920, formato story) con los "Favoritos del
// Público" de una prueba: el top 3 más votado para Oro, Plata y Bronce con su
// porcentaje. Se dibuja en un <canvas> en el navegador.

export interface FavoriteStat {
  name: string;
  country: string;
  percent: number;
}

export interface FavoriteGroup {
  title: string;
  color: string;
  stats: FavoriteStat[];
}

export interface FavoritesLabels {
  button: string;
  working: string;
  error: string;
  title: string;
  subtitle: string;
}

export function drawFavorites(
  canvas: HTMLCanvasElement,
  p: { eventName: string; competitionName: string; groups: FavoriteGroup[]; title: string; subtitle: string },
  logo: HTMLImageElement | null,
  flags: Map<string, HTMLImageElement>
) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const logoSize = 190;
  if (logo) ctx.drawImage(logo, W - PAD - logoSize, 70, logoSize, logoSize);

  const headW = W - PAD * 2 - logoSize - 30;
  const titleLines = wrapFit(ctx, p.title, headW, 900, 70, 44, 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${titleLines.px}px ${FONT}`;
  let hy = 140;
  titleLines.lines.forEach((l) => {
    ctx.fillText(l, PAD, hy);
    hy += titleLines.px + 8;
  });
  const ev = wrapFit(ctx, p.eventName, headW, 800, 42, 28, 2);
  ctx.fillStyle = GOLD;
  ctx.font = `800 ${ev.px}px ${FONT}`;
  hy += 14;
  ev.lines.forEach((line) => {
    ctx.fillText(line, PAD, hy);
    hy += ev.px + 10;
  });
  ctx.fillStyle = "rgba(226,237,245,0.7)";
  ctx.font = `600 ${fitPx(ctx, p.subtitle, headW, 600, 30, 20)}px ${FONT}`;
  ctx.fillText(p.subtitle, PAD, hy + 8);

  const top = Math.max(360, hy + 60);
  const bottom = H - 230;
  const maxW = W - PAD * 2;
  const gap = 26;
  const n = Math.max(1, p.groups.length);
  const cardH = Math.min(380, (bottom - top - gap * (n - 1)) / n);
  const headH = 64;
  const rowH = (cardH - headH - 14) / 3;

  p.groups.forEach((g, gi) => {
    const y0 = top + gi * (cardH + gap);
    roundRect(ctx, PAD, y0, maxW, cardH, 20);
    ctx.fillStyle = "#10304b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = g.color;
    ctx.stroke();

    // Medalla (círculo de color) + título del puesto
    ctx.beginPath();
    ctx.arc(PAD + 40, y0 + 38, 14, 0, Math.PI * 2);
    ctx.fillStyle = g.color;
    ctx.fill();
    ctx.fillStyle = g.color;
    ctx.font = `800 32px ${FONT}`;
    ctx.fillText(g.title, PAD + 70, y0 + 49);

    g.stats.slice(0, 3).forEach((s, si) => {
      const ry = y0 + headH + si * rowH;
      const innerX = PAD + 30;
      const innerW = maxW - 60;

      let x = innerX;
      const flag = flags.get(s.country.trim().toUpperCase());
      if (flag) {
        const fh = 30;
        const fw = fh * (4 / 3);
        ctx.save();
        roundRect(ctx, x, ry + 8, fw, fh, 4);
        ctx.clip();
        ctx.drawImage(flag, x, ry + 8, fw, fh);
        ctx.restore();
        x += fw + 14;
      }

      const pct = `${s.percent}%`;
      ctx.font = `800 34px ${FONT}`;
      const pctW = ctx.measureText(pct).width;
      ctx.fillStyle = g.color;
      ctx.textAlign = "right";
      ctx.fillText(pct, innerX + innerW, ry + 38);
      ctx.textAlign = "left";

      const nameMax = innerX + innerW - pctW - 24 - x;
      const namePx = fitPx(ctx, s.name, nameMax, 700, 32, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${namePx}px ${FONT}`;
      ctx.fillText(s.name, x, ry + 37);

      // Barra de porcentaje
      const barY = ry + 52;
      roundRect(ctx, innerX, barY, innerW, 12, 6);
      ctx.fillStyle = "rgba(226,237,245,0.12)";
      ctx.fill();
      const bw = Math.max(12, (innerW * Math.min(100, s.percent)) / 100);
      roundRect(ctx, innerX, barY, bw, 12, 6);
      ctx.fillStyle = g.color;
      ctx.fill();
    });
  });

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText("rollartfantasy.com", PAD, H - 130);
  ctx.fillStyle = "rgba(226,237,245,0.7)";
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText("Instagram · X  @rollartfantasy", PAD, H - 75);
}

export default function PublicFavoritesImageButton({
  eventName,
  competitionName,
  groups,
  labels,
}: {
  eventName: string;
  competitionName: string;
  groups: FavoriteGroup[];
  labels: FavoritesLabels;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const handle = async () => {
    setBusy(true);
    setError(false);
    try {
      const all = groups.flatMap((g) => g.stats.slice(0, 3));
      const [logo, flags] = await Promise.all([loadImage(logoMark.src), loadFlags(all)]);
      const canvas = document.createElement("canvas");
      drawFavorites(
        canvas,
        { eventName, competitionName, groups, title: labels.title, subtitle: labels.subtitle },
        logo,
        flags
      );
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no blob");
      const slug = `rollart-fantasy-favoritos-${eventName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-50"
      >
        {busy ? labels.working : labels.button}
      </button>
      {error && <span className="text-[11px] text-red-400">{labels.error}</span>}
    </div>
  );
}
