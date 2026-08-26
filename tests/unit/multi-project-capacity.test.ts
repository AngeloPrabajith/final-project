import { describe, expect, it } from "vitest";
import {
  computeAllocationFactor,
  computeContextSwitchFactor,
} from "@/services/multi-project-capacity.service";

describe("allocation factor — 1/(N+1) equal split across concurrent sprints", () => {
  it("gives full capacity to a developer on a single sprint (N=0)", () => {
    expect(computeAllocationFactor(0)).toBe(1);
  });

  it("halves capacity when one other concurrent sprint exists (N=1)", () => {
    expect(computeAllocationFactor(1)).toBe(0.5);
  });

  it("splits capacity three ways at N=2", () => {
    expect(computeAllocationFactor(2)).toBeCloseTo(1 / 3, 10);
  });

  it("splits capacity four ways at N=3", () => {
    expect(computeAllocationFactor(3)).toBe(0.25);
  });

  // Handbook §3: floored so a developer on many projects is never modelled
  // as having effectively zero capacity per sprint.
  it("floors the allocation factor at 0.25 when a developer is on five or more concurrent sprints", () => {
    expect(computeAllocationFactor(4)).toBe(0.25); // raw 1/5 = 0.2 → floor
    expect(computeAllocationFactor(9)).toBe(0.25); // raw 1/10 = 0.1 → floor
  });

  it("treats a negative count defensively as zero", () => {
    expect(computeAllocationFactor(-1)).toBe(1);
  });
});

describe("context-switch factor — 20% loss per context past the first extra", () => {
  it("applies no penalty for a single sprint (N=0)", () => {
    expect(computeContextSwitchFactor(0)).toBe(1);
  });

  // Handbook §3: two concurrent sprints incur no penalty — one extra context
  // is the baseline (Cohn 2005; Sutherland; Weinberg).
  it("applies no penalty for exactly two concurrent sprints (N=1)", () => {
    expect(computeContextSwitchFactor(1)).toBe(1);
  });

  it("costs 20% at three concurrent sprints (N=2)", () => {
    expect(computeContextSwitchFactor(2)).toBeCloseTo(0.8, 10);
  });

  it("costs 40% at four concurrent sprints (N=3)", () => {
    expect(computeContextSwitchFactor(3)).toBeCloseTo(0.6, 10);
  });

  it("floors the context-switch factor at 0.5 however many sprints are stacked", () => {
    expect(computeContextSwitchFactor(4)).toBe(0.5); // raw 1 − 0.2×3 = 0.4 → floor
    expect(computeContextSwitchFactor(10)).toBe(0.5);
  });
});
