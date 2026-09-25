import { describe, it, expect } from "vitest";
import { effectiveLocksAt, isSegmentLocked, firstSegmentEffectiveLocksAt } from "./segments";

const eventLocksAt = new Date("2026-06-01T00:00:00Z");

describe("effectiveLocksAt", () => {
  it("usa el locksAt propio del segmento si existe", () => {
    const segment = { id: "s1", order: 0, locksAt: new Date("2026-05-01T00:00:00Z") };
    expect(effectiveLocksAt(segment, eventLocksAt)).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("hereda el rosterLocksAt del evento si el segmento no tiene locksAt propio", () => {
    const segment = { id: "s1", order: 0, locksAt: null };
    expect(effectiveLocksAt(segment, eventLocksAt)).toEqual(eventLocksAt);
  });
});

describe("isSegmentLocked", () => {
  it("está cerrado si el plazo efectivo ya pasó", () => {
    const segment = { id: "s1", order: 0, locksAt: new Date("2020-01-01T00:00:00Z") };
    expect(isSegmentLocked(segment, eventLocksAt, new Date("2026-01-01T00:00:00Z"))).toBe(true);
  });

  it("sigue abierto si el plazo efectivo es futuro", () => {
    const segment = { id: "s1", order: 0, locksAt: new Date("2027-01-01T00:00:00Z") };
    expect(isSegmentLocked(segment, eventLocksAt, new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });

  it("un segmento puede estar cerrado mientras otro del mismo evento sigue abierto", () => {
    const now = new Date("2026-05-15T00:00:00Z");
    const corto = { id: "corto", order: 1, locksAt: new Date("2026-05-01T00:00:00Z") };
    const largo = { id: "largo", order: 2, locksAt: new Date("2026-06-01T00:00:00Z") };
    expect(isSegmentLocked(corto, eventLocksAt, now)).toBe(true);
    expect(isSegmentLocked(largo, eventLocksAt, now)).toBe(false);
  });
});

describe("firstSegmentEffectiveLocksAt", () => {
  it("usa el rosterLocksAt del evento si no hay segmentos", () => {
    expect(firstSegmentEffectiveLocksAt([], eventLocksAt)).toEqual(eventLocksAt);
  });

  it("toma el segmento de menor order (Corto), no el orden en que se pasan", () => {
    const largo = { id: "largo", order: 2, locksAt: new Date("2026-07-01T00:00:00Z") };
    const corto = { id: "corto", order: 1, locksAt: new Date("2026-04-01T00:00:00Z") };
    expect(firstSegmentEffectiveLocksAt([largo, corto], eventLocksAt)).toEqual(
      new Date("2026-04-01T00:00:00Z")
    );
  });

  it("si el Corto no tiene locksAt propio, hereda el del evento", () => {
    const corto = { id: "corto", order: 1, locksAt: null };
    const largo = { id: "largo", order: 2, locksAt: new Date("2026-07-01T00:00:00Z") };
    expect(firstSegmentEffectiveLocksAt([corto, largo], eventLocksAt)).toEqual(eventLocksAt);
  });
});
