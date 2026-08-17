import { describe, it, expect } from "vitest";
import { labelForResponseSource } from "./response-label";
import type { PyNode } from "@/types/workflow";

function makeNode(type: string, data: Record<string, unknown>): PyNode {
  return { id: "n1", type, position: { x: 0, y: 0 }, data } as unknown as PyNode;
}

describe("labelForResponseSource", () => {
  it('returns "input" for undefined source node', () => {
    expect(labelForResponseSource(undefined, null)).toBe("input");
  });

  it("returns the field name for request-type nodes", () => {
    const requestNode = makeNode("request", {
      fields: [
        { id: "f1", name: "user_prompt" },
        { id: "f2", name: "image_input" },
      ],
    });
    expect(labelForResponseSource(requestNode, "f1")).toBe("user_prompt");
    expect(labelForResponseSource(requestNode, "f2")).toBe("image_input");
  });

  it('returns "input" for request node with unknown handle', () => {
    const requestNode = makeNode("request", {
      fields: [{ id: "f1", name: "text" }],
    });
    expect(labelForResponseSource(requestNode, "unknown")).toBe("input");
  });

  it("normalizes the label for non-request nodes", () => {
    const geminiNode = makeNode("gemini", { label: "Gemini 2.5 Flash" });
    expect(labelForResponseSource(geminiNode, "response")).toBe("gemini_2_5_flash");
  });

  it("handles special characters in labels", () => {
    const node = makeNode("gemini", { label: "My Node (v2) - Final!" });
    expect(labelForResponseSource(node, null)).toBe("my_node_v2_final");
  });

  it("falls back to 'node' when label normalizes to empty", () => {
    const node = makeNode("crop_image", { label: "" });
    expect(labelForResponseSource(node, null)).toBe("node");
  });
});
