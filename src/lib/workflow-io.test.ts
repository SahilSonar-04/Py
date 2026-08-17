import { describe, it, expect } from "vitest";
import { parseWorkflowImport, WorkflowImportError } from "./workflow-io";

describe("parseWorkflowImport", () => {
  it("parses a valid export with graph wrapper", () => {
    const raw = JSON.stringify({
      formatVersion: 1,
      name: "Test",
      graph: { nodes: [{ id: "a" }], edges: [] },
    });
    const result = parseWorkflowImport(raw);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.name).toBe("Test");
  });

  it("parses a flat graph (no graph wrapper)", () => {
    const raw = JSON.stringify({
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", source: "a", target: "b" }],
    });
    const result = parseWorkflowImport(raw);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.name).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(() => parseWorkflowImport("{not json")).toThrow(WorkflowImportError);
  });

  it("rejects non-object JSON", () => {
    expect(() => parseWorkflowImport('"hello"')).toThrow(WorkflowImportError);
  });

  it("rejects missing nodes/edges", () => {
    expect(() => parseWorkflowImport(JSON.stringify({ foo: "bar" }))).toThrow(WorkflowImportError);
  });

  it("rejects nodes with missing id", () => {
    const raw = JSON.stringify({
      nodes: [{ type: "gemini" }],
      edges: [],
    });
    expect(() => parseWorkflowImport(raw)).toThrow(WorkflowImportError);
  });
});
