import { describe, it, expect } from "vitest";
import { assertNoCycles } from "./orchestrator";
import type { PyNode, PyEdge } from "@/types/workflow";

function node(id: string): PyNode {
  return { id, type: "gemini", position: { x: 0, y: 0 }, data: { label: id } } as PyNode;
}

function edge(source: string, target: string): PyEdge {
  return { id: `${source}-${target}`, source, target };
}

describe("assertNoCycles", () => {
  it("accepts a valid DAG", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(() => assertNoCycles(nodes, edges)).not.toThrow();
  });

  it("accepts a diamond DAG (no cycle)", () => {
    const nodes = [node("a"), node("b"), node("c"), node("d")];
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    expect(() => assertNoCycles(nodes, edges)).not.toThrow();
  });

  it("throws on a simple cycle", () => {
    const nodes = [node("a"), node("b")];
    const edges = [edge("a", "b"), edge("b", "a")];
    expect(() => assertNoCycles(nodes, edges)).toThrow(/Cycle detected/);
  });

  it("throws on a longer cycle", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    expect(() => assertNoCycles(nodes, edges)).toThrow(/Cycle detected/);
  });

  it("throws on a self-loop", () => {
    const nodes = [node("a")];
    const edges = [edge("a", "a")];
    expect(() => assertNoCycles(nodes, edges)).toThrow(/Cycle detected/);
  });

  it("accepts disconnected nodes", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges: PyEdge[] = [];
    expect(() => assertNoCycles(nodes, edges)).not.toThrow();
  });
});
