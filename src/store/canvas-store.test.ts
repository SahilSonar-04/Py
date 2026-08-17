import { describe, it, expect } from "vitest";
import { isCompatible, wouldCreateCycle } from "./canvas-store";
import type { PyEdge } from "@/types/workflow";

describe("isCompatible", () => {
  it("allows same types", () => {
    expect(isCompatible("text", "text")).toBe(true);
    expect(isCompatible("image", "image")).toBe(true);
    expect(isCompatible("number", "number")).toBe(true);
  });

  it("rejects different types", () => {
    expect(isCompatible("text", "image")).toBe(false);
    expect(isCompatible("image", "text")).toBe(false);
    expect(isCompatible("number", "text")).toBe(false);
  });

  it("accepts 'any' as source", () => {
    expect(isCompatible("any", "text")).toBe(true);
    expect(isCompatible("any", "image")).toBe(true);
  });

  it("accepts 'any' as target", () => {
    expect(isCompatible("text", "any")).toBe(true);
    expect(isCompatible("image", "any")).toBe(true);
  });

  it("accepts any-to-any", () => {
    expect(isCompatible("any", "any")).toBe(true);
  });
});

function edge(source: string, target: string): PyEdge {
  return { id: `${source}-${target}`, source, target };
}

describe("wouldCreateCycle", () => {
  it("detects a direct back-edge", () => {
    const edges = [edge("a", "b")];
    expect(wouldCreateCycle(edges, "a", "b")).toBe(false); // adding a->b when it already exists is not a cycle through new edge check
    expect(wouldCreateCycle(edges, "b", "a")).toBe(true);  // b->a would create a cycle
  });

  it("detects an indirect cycle", () => {
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true);
  });

  it("allows non-cyclic edges", () => {
    const edges = [edge("a", "b"), edge("a", "c")];
    expect(wouldCreateCycle(edges, "b", "c")).toBe(false);
  });

  it("handles empty graph", () => {
    expect(wouldCreateCycle([], "a", "b")).toBe(false);
  });
});
