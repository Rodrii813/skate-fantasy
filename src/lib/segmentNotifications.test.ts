import { describe, it, expect } from "vitest";
import { decideSegmentNotifications } from "./segmentNotifications";

const now = new Date("2026-10-10T12:00:00Z");
const min = (m: number) => new Date(now.getTime() + m * 60000);

const seg = (over: Partial<{ opensAt: Date | null; locksAt: Date | null; manuallyOpened: boolean }> = {}) => ({
  id: "s1",
  order: 1,
  locksAt: null as Date | null,
  opensAt: null as Date | null,
  manuallyOpened: false,
  ...over,
});

describe("decideSegmentNotifications", () => {
  it("avisa de apertura si se abrió hace poco", () => {
    const d = decideSegmentNotifications(seg({ opensAt: min(-20) }), min(600), true, now);
    expect(d.opened).toBe(true);
    expect(d.closingSoon).toBe(false);
  });

  it("no avisa de aperturas antiguas ni sin fecha ni manuales", () => {
    expect(decideSegmentNotifications(seg({ opensAt: min(-600) }), min(600), true, now).opened).toBe(false);
    expect(decideSegmentNotifications(seg(), min(600), true, now).opened).toBe(false);
    expect(decideSegmentNotifications(seg({ manuallyOpened: true, opensAt: new Date("2099-01-01") }), min(600), true, now).opened).toBe(false);
  });

  it("avisa cuando queda 1 hora o menos para el cierre", () => {
    expect(decideSegmentNotifications(seg(), min(45), true, now).closingSoon).toBe(true);
    expect(decideSegmentNotifications(seg(), min(61), true, now).closingSoon).toBe(false);
  });

  it("usa el cierre propio del segmento si lo tiene", () => {
    const d = decideSegmentNotifications(seg({ locksAt: min(30) }), min(600), true, now);
    expect(d.closingSoon).toBe(true);
    expect(d.minutesLeft).toBe(30);
  });

  it("no avisa si ya está cerrado, no abierto o sin slots", () => {
    expect(decideSegmentNotifications(seg(), min(-5), true, now).closingSoon).toBe(false);
    expect(decideSegmentNotifications(seg({ opensAt: min(60) }), min(120), true, now).closingSoon).toBe(false);
    expect(decideSegmentNotifications(seg(), min(30), false, now).closingSoon).toBe(false);
  });
});
