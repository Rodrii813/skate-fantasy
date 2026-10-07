"use client";

import Link from "next/link";
import LocalDateTime from "./LocalDateTime";
import { useCallback, useEffect, useRef, useState } from "react";

// Carrusel del banner de la home: una diapositiva por prueba del día. En móvil
// se desliza con el dedo (scroll horizontal con "snap" nativo); en escritorio
// hay flecha delante y detrás; abajo van los puntitos. Pasa solo cada pocos
// segundos y se detiene mientras el usuario lo toca / tiene el ratón encima.

export interface HomeEventSlide {
  id: string;
  competitionName: string;
  name: string;
  predictionsOpen: boolean;
  draftOpen: boolean;
  // Ya cerrados (distinto de "aún no abiertos").
  predictionsClosed: boolean;
  draftClosed: boolean;
  // Fecha de cierre como ISO: se formatea en el cliente, en la zona horaria
  // del usuario (el servidor solo conoce UTC).
  closeLines: { label: string; at: string }[];
}

export interface HomeEventCarouselLabels {
  liveBoth: string;
  livePredictionsOnly: string;
  liveDraftOnly: string;
  upcoming: string;
  predictOpen: string;
  predictClosed: string;
  predictDone: string;
  draftDone: string;
  draftOpen: string;
  draftClosed: string;
  prev: string;
  next: string;
  goTo: string; // "Ir al evento"
}

const AUTOPLAY_MS = 6000;

export default function HomeEventCarousel({
  slides,
  labels,
}: {
  slides: HomeEventSlide[];
  labels: HomeEventCarouselLabels;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const count = slides.length;

  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduceMotion(mq.matches);
    } catch {
      /* sin matchMedia: se deja el autoplay */
    }
  }, []);

  const goTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  }, []);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(count - 1, i)));
  };

  // Autoplay: se reprograma tras cada cambio (también los manuales).
  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const timer = setTimeout(() => goTo((index + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reduceMotion, count, goTo]);

  const multi = count > 1;
  const arrowClass =
    "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg text-ice-100/80 transition hover:bg-white/15 hover:text-white sm:flex";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-rink via-rink to-gold/10 shadow-xl shadow-black/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />

      {multi && (
        <button
          type="button"
          aria-label={labels.prev}
          className={`${arrowClass} left-3`}
          onClick={() => goTo((index - 1 + count) % count)}
        >
          ‹
        </button>
      )}
      {multi && (
        <button
          type="button"
          aria-label={labels.next}
          className={`${arrowClass} right-3`}
          onClick={() => goTo((index + 1) % count)}
        >
          ›
        </button>
      )}

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="relative flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s) => {
            const live = s.predictionsOpen || s.draftOpen;
            return (
              <div key={s.id} className="w-full shrink-0 snap-center">
                <div
                  className={`flex h-full flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6 ${
                    multi ? "pb-9 sm:px-16 sm:pb-6" : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {live ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                          ●{" "}
                          {s.predictionsOpen && s.draftOpen
                            ? labels.liveBoth
                            : s.predictionsOpen
                            ? labels.livePredictionsOnly
                            : labels.liveDraftOnly}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-white/10 text-ice-100/60 border border-white/15 px-2 py-0.5 rounded-full">
                          {labels.upcoming}
                        </span>
                      )}
                      <span className="text-xs text-ice-100/50 font-mono">{s.competitionName}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-display font-black text-white">{s.name}</h2>
                    <p className="text-xs text-ice-100/50 flex flex-wrap gap-x-3">
                      {s.closeLines.map((l) => (
                        <span key={l.label}>
                          {l.label}:{" "}
                          <LocalDateTime
                            value={l.at}
                            options={{ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }}
                          />
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <Link
                      href={`/predictions?event=${s.id}`}
                      className={`flex-1 sm:flex-none text-center text-xs font-semibold px-4 py-2.5 rounded-xl transition ${
                        s.predictionsOpen
                          ? "bg-accent hover:bg-accent/90 text-rink"
                          : "bg-white/10 hover:bg-white/15 text-ice-100/50 border border-white/10"
                      }`}
                    >
                      {s.predictionsOpen ? labels.predictOpen : s.predictionsClosed ? labels.predictDone : labels.predictClosed}
                    </Link>
                    <Link
                      href={`/events/${s.id}`}
                      className={`flex-1 sm:flex-none text-center text-xs font-semibold px-4 py-2.5 rounded-xl transition ${
                        s.draftOpen
                          ? "bg-gold hover:bg-gold/90 text-rink"
                          : "bg-white/10 hover:bg-white/15 text-ice-100/50 border border-white/10"
                      }`}
                    >
                      {s.draftOpen ? labels.draftOpen : s.draftClosed ? labels.draftDone : labels.draftClosed}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      {multi && (
        <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2 sm:bottom-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${labels.goTo} ${i + 1}/${count}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-gold" : "w-1.5 bg-white/25 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
