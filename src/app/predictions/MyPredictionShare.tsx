"use client";

import { useState } from "react";
import logoMark from "@/app/_components/logo-mark.png";
import { W, H, PAD, BG, GOLD, FONT, wrapFit, roundRect, fitPx, loadImage, loadFlags } from "@/lib/canvasKit";

// Imagen (formato story 1080x1920) con las elecciones del propio usuario:
// su top 3, 4 o 5 según lo que haya enviado, sin porcentajes. Se dibuja en un
// <canvas> en el navegador. Botones: compartir, descargar y copiar enlace.

export interface MyPick {
  name: string;
  country: string;
}

export interface MyPredictionLabels {
  title: string;
  share: string;
  download: string;
  copyLink: string;
  copied: string;
  downloaded: string;
  working: string;
  error: string;
  shareText: (url: string) => string;
}

const MEDALS = ["#c9a227", "#b8c2cc", "#cd7f32"];

function drawMyPrediction(
  canvas: HTMLCanvasElement,
  p: { eventName: string; competitionName: string; title: string; picks: MyPick[] },
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
  const title = wrapFit(ctx, p.title, headW, 900, 76, 44, 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${title.px}px ${FONT}`;
  let hy = 140;
  title.lines.forEach((l) => {
    ctx.fillText(l, PAD, hy);
    hy += title.px + 8;
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
  ctx.font = `600 ${fitPx(ctx, p.competitionName, headW, 600, 30, 20)}px ${FONT}`;
  ctx.fillText(p.competitionName, PAD, hy + 8);

  const top = Math.max(380, hy + 70);
  const bottom = H - 260;
  const maxW = W - PAD * 2;
  const gap = 24;
  const n = Math.max(1, p.picks.length);
  const rowH = Math.min(190, (bottom - top - gap * (n - 1)) / n);

  p.picks.forEach((pick, i) => {
    const y0 = top + i * (rowH + gap);
    const color = MEDALS[i] ?? "#2fb6a3";
    roundRect(ctx, PAD, y0, maxW, rowH, 22);
    ctx.fillStyle = "#10304b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Círculo con el puesto
    const cx = PAD + 66;
    const cy = y0 + rowH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = BG;
    ctx.font = `900 46px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), cx, cy + 16);
    ctx.textAlign = "left";

    let x = PAD + 140;
    const flag = flags.get(pick.country.trim().toUpperCase());
    if (flag) {
      const fh = 44;
      const fw = fh * (4 / 3);
      ctx.save();
      roundRect(ctx, x, cy - fh / 2, fw, fh, 6);
      ctx.clip();
      ctx.drawImage(flag, x, cy - fh / 2, fw, fh);
      ctx.restore();
      x += fw + 22;
    }
    const nameMax = PAD + maxW - 30 - x;
    const lines = wrapFit(ctx, pick.name, nameMax, 800, 46, 26, 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${lines.px}px ${FONT}`;
    const total = lines.lines.length * (lines.px + 6);
    let ty = cy - total / 2 + lines.px - 2;
    lines.lines.forEach((l) => {
      ctx.fillText(l, x, ty);
      ty += lines.px + 6;
    });
  });

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText("rollartfantasy.com", PAD, H - 130);
  ctx.fillStyle = "rgba(226,237,245,0.7)";
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText("Instagram · X  @rollartfantasy", PAD, H - 75);
}

export default function MyPredictionShare({
  eventName,
  competitionName,
  picks,
  linkPath,
  labels,
}: {
  eventName: string;
  competitionName: string;
  picks: MyPick[];
  linkPath: string;
  labels: MyPredictionLabels;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const flash = (text: string, error = false) => {
    setNote({ text, error });
    setTimeout(() => setNote(null), 3500);
  };

  const linkUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://rollartfantasy.com";
    return `${origin}${linkPath}`;
  };

  const buildFile = async (): Promise<File> => {
    const [logo, flags] = await Promise.all([loadImage(logoMark.src), loadFlags(picks)]);
    const canvas = document.createElement("canvas");
    drawMyPrediction(canvas, { eventName, competitionName, title: labels.title, picks }, logo, flags);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("no blob");
    const slug = `rollart-fantasy-mi-prediccion-${eventName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return new File([blob], `${slug}.png`, { type: "image/png" });
  };

  const saveFile = (file: File) => {
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    flash(labels.downloaded);
  };

  const handleShare = async () => {
    setBusy(true);
    setNote(null);
    try {
      const file = await buildFile();
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: labels.shareText(linkUrl()) });
          return;
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
        }
      }
      saveFile(file);
    } catch {
      flash(labels.error, true);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    setNote(null);
    try {
      saveFile(await buildFile());
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

  const btn = "rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className={`${btn} border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25`}
        >
          {busy ? labels.working : labels.share}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className={`${btn} border-emerald-500/40 bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600/25`}
        >
          {labels.download}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className={`${btn} border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700`}
        >
          {labels.copyLink}
        </button>
      </div>
      {note && <p className={`text-[11px] ${note.error ? "text-red-400" : "text-emerald-400"}`}>{note.text}</p>}
    </div>
  );
}
