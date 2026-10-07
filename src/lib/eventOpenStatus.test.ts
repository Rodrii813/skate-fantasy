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
