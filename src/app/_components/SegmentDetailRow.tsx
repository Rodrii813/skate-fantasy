"use client";

import { useState, type CSSProperties } from "react";
import type { SkaterDetailTable } from "@/lib/pdfJudgesDetailTable";
import type { SegmentResultRow } from "@/lib/segmentResults";

// Fila de resultados de un segmento con desplegable del acta completo
// (elementos, QOE, notas de cada juez y components), como en las
// plataformas oficiales. El detalle se pide al abrir, no al cargar la página.

export interface DetailLabels {
  loading: string;
  missing: string;
  element: string;
  base: string;
  qoe: string;
  score: string;
  components: string;
  totalElements: string;
  deductions: string;
}

const f2 = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(2));

function judgeStyle(v: number): CSSProperties {
  if (v === 0) return {};
  const a = Math.min(0.22 + Math.abs(v) * 0.16, 0.9);
  return {
    backgroundColor: v > 0 ? `rgba(37,99,235,${a})` : `rgba(220,38,38,${a * 0.85})`,
  };
}

function judgeText(v: number) {
  return v > 0 ? `+${v}` : String(v);
}

function DetailTable({ d, labels }: { d: SkaterDetailTable; labels: DetailLabels }) {
  const judges = Array.from({ length: d.judgeCount }, (_, i) => i);
  return (
    <div className="space-y-4 text-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse font-mono">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1.5 px-2 text-left w-7">#</th>
              <th className="py-1.5 px-2 text-left font-sans">{labels.element}</th>
              {judges.map((i) => (
                <th key={i} className="py-1.5 px-0 text-center w-10 min-w-[2.5rem]">
                  J{i + 1}
                </th>
              ))}
              <th className="py-1 px-3 text-right">{labels.base}</th>
              <th className="py-1 px-3 text-right">{labels.qoe}</th>
              <th className="py-1 px-3 text-right">{labels.score}</th>
            </tr>
          </thead>
          <tbody>
            {d.elements.map((el) => {
              const isGroup = el.judges.length > 0;
              return (
                <ElementBlock key={el.n} el={el} isGroup={isGroup} judgeCount={d.judgeCount} />
              );
            })}
            <tr className="border-t border-slate-700 font-bold text-slate-200">
              <td className="py-1.5 px-2" />
              <td className="py-1.5 px-2 font-sans">{labels.totalElements}</td>
              <td colSpan={d.judgeCount} />
              <td className="py-1 px-3 text-right">{f2(d.baseTotal)}</td>
              <td className="py-1 px-3 text-right">{f2(d.qoeTotal)}</td>
              <td className="py-1 px-3 text-right text-indigo-400">{f2(d.tes)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse font-mono">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1.5 px-2 text-left font-sans">{labels.components}</th>
              {judges.map((i) => (
                <th key={i} className="py-1.5 px-1 text-center w-11">
                  J{i + 1}
                </th>
              ))}
              <th className="py-1 px-3 text-right">×</th>
              <th className="py-1 px-3 text-right">PCS</th>
            </tr>
          </thead>
          <tbody>
            {d.components.map((c) => (
              <tr key={c.name} className="border-t border-slate-800/80 text-slate-300">
                <td className="py-1.5 px-2 font-sans text-slate-200">{c.name}</td>
                {c.judges.map((v, i) => (
                  <td key={i} className="py-1.5 px-1 text-center">
                    {v.toFixed(2)}
                  </td>
                ))}
                <td className="py-1 px-3 text-right text-slate-500">{c.factor}</td>
                <td className="py-1 px-3 text-right font-bold">{c.score.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-700 font-bold text-slate-200">
              <td className="py-1.5 px-2 font-sans">PCS</td>
              <td colSpan={d.judgeCount + 1} />
              <td className="py-1 px-3 text-right text-indigo-400">{f2(d.pcs)}</td>
            </tr>
            <tr className="text-slate-400">
              <td className="py-1.5 px-2 font-sans">{labels.deductions}</td>
              <td colSpan={d.judgeCount + 1} />
              <td className="py-1 px-3 text-right">{f2(d.ded)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ElementBlock({
  el,
  isGroup,
  judgeCount,
}: {
  el: SkaterDetailTable["elements"][number];
  isGroup: boolean;
  judgeCount: number;
}) {
  const judgeCells = (vals: number[]) =>
    Array.from({ length: judgeCount }, (_, i) => {
      const v = vals[i];
      return (
        <td
          key={i}
          style={v === undefined ? undefined : judgeStyle(v)}
          className="h-8 w-10 min-w-[2.5rem] px-0 text-center text-slate-100 font-semibold"
        >
          {v === undefined ? "" : judgeText(v)}
        </td>
      );
    });

  return (
    <>
      {isGroup && (
        <tr className="border-t border-slate-800/80 text-slate-200">
          <td className="py-1 px-2 text-slate-500">{el.n}</td>
          <td className="py-1.5 px-2 font-sans font-semibold">{el.type}</td>
          {judgeCells(el.judges)}
          <td colSpan={3} />
        </tr>
      )}
      {el.rows.map((r, idx) => (
        <tr
          key={idx}
          className={`${!isGroup && idx === 0 ? "border-t border-slate-800/80" : ""} text-slate-300`}
        >
          <td className="py-1.5 px-2 text-slate-500">{!isGroup && idx === 0 ? el.n : ""}</td>
          <td className={`py-1.5 px-2 font-sans ${isGroup || idx > 0 ? "pl-5" : ""}`}>
            <span className="font-semibold text-slate-100">{r.code}</span>
            {r.marks && <span className="ml-1 text-amber-400">{r.marks}</span>}
            {r.flags && <span className="ml-1 text-sky-400">{r.flags}</span>}
            {r.name && <span className="ml-2 text-[10px] text-slate-500">{r.name}</span>}
          </td>
          {judgeCells(r.judges)}
          <td className="py-1 px-3 text-right">{f2(r.base)}</td>
          <td className="py-1 px-3 text-right">{r.qoe === null ? "" : f2(r.qoe)}</td>
          <td className="py-1 px-3 text-right font-bold text-slate-100">{f2(r.score)}</td>
        </tr>
      ))}
    </>
  );
}

export default function SegmentDetailRow({
  row,
  segmentId,
  labels,
}: {
  row: SegmentResultRow;
  segmentId: string;
  labels: DetailLabels;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "missing">("idle");
  const [data, setData] = useState<SkaterDetailTable | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") {
      setState("loading");
      try {
        const res = await fetch(
          `/api/results/detail?registrationId=${encodeURIComponent(row.registrationId)}&segmentId=${encodeURIComponent(segmentId)}`
        );
        if (!res.ok) throw new Error("missing");
        setData(await res.json());
        setState("ok");
      } catch {
        setState("missing");
      }
    }
  }

  const clickable = row.hasDetail;
  return (
    <>
      <tr
        onClick={clickable ? toggle : undefined}
        className={`hover:bg-slate-800/30 transition font-mono ${clickable ? "cursor-pointer" : ""}`}
      >
        <td className="py-3 px-5 font-bold text-slate-400">{row.rank !== null ? `#${row.rank}` : "—"}</td>
        <td className="py-3 px-4 font-sans font-semibold text-slate-200">
          {clickable && (
            <svg
              viewBox="0 0 12 12"
              className={`mr-2 inline-block h-3 w-3 align-[-1px] text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {row.skaterName}{" "}
          {row.country && <span className="font-mono text-[11px] text-slate-500">({row.country})</span>}
        </td>
        <td className="py-3 px-4 text-right font-bold text-indigo-400 text-base">{f2(row.total)}</td>
        <td className="py-3 px-4 text-right text-slate-300">{f2(row.tes)}</td>
        <td className="py-3 px-4 text-right text-slate-300">{f2(row.pcs)}</td>
        <td className="py-3 px-4 text-right text-slate-400">{row.deductions.toFixed(2)}</td>
      </tr>
      {open && (
        <tr className="bg-slate-900/60">
          <td colSpan={6} className="px-3 sm:px-5 py-4">
            {state === "loading" && <p className="text-xs text-slate-500">{labels.loading}</p>}
            {state === "missing" && <p className="text-xs text-slate-500">{labels.missing}</p>}
            {state === "ok" && data && <DetailTable d={data} labels={labels} />}
          </td>
        </tr>
      )}
    </>
  );
}
