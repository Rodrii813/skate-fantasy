import { describe, it, expect } from "vitest";
import { computeEventOpenStatus } from "./eventOpenStatus";
const base: any = { status: "UPCOMING", rosterLocksAt: "2026-10-07T20:00:00Z", predictionsOpensAt: null, predictionsManuallyOpened: false, _count: { registrations: 5 }, slots: [{ segmentId: "a" }] };
describe("cierre draft", () => {
  it("usa el plazo del segmento", () => {
    const r = computeEventOpenStatus({ ...base, segments: [{ id: "a", order: 1, locksAt: "2026-10-07T18:00:00Z", opensAt: null, manuallyOpened: false }] }, new Date("2026-10-07T10:00:00Z"));
    expect(r.draftCloseAt.toISOString()).toBe("2026-10-07T18:00:00.000Z");
    expect(r.predictionsCloseAt.toISOString()).toBe("2026-10-07T18:00:00.000Z");
  });
  it("sin override usa el del evento", () => {
    const r = computeEventOpenStatus({ ...base, segments: [{ id: "a", order: 1, locksAt: null, opensAt: null, manuallyOpened: false }] }, new Date("2026-10-07T10:00:00Z"));
    expect(r.draftCloseAt.toISOString()).toBe("2026-10-07T20:00:00.000Z");
  });
});

describe("estados cerrado / aún no abierto", () => {
  it("predicciones cerradas y draft del Largo aún sin abrir", () => {
    const ev: any = {
      ...base,
      slots: [{ segmentId: "a" }, { segmentId: "b" }],
      segments: [
        { id: "a", order: 1, locksAt: "2026-10-07T18:00:00Z", opensAt: null, manuallyOpened: false },
        { id: "b", order: 2, locksAt: "2026-10-09T18:00:00Z", opensAt: "2026-10-09T00:00:00Z", manuallyOpened: false },
      ],
    };
    const r = computeEventOpenStatus(ev, new Date("2026-10-08T00:00:00Z"));
    expect(r.predictionsStatus).toBe("CLOSED");
    expect(r.draftStatus).toBe("UPCOMING");
  });
  it("todo cerrado", () => {
    const ev: any = { ...base, segments: [{ id: "a", order: 1, locksAt: "2026-10-07T18:00:00Z", opensAt: null, manuallyOpened: false }] };
    const r = computeEventOpenStatus(ev, new Date("2026-10-08T00:00:00Z"));
    expect(r.predictionsStatus).toBe("CLOSED");
    expect(r.draftStatus).toBe("CLOSED");
  });
});
