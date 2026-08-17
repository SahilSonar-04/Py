import { describe, it, expect } from "vitest";
import { cropImageTaskInputSchema } from "./schemas";

describe("cropImageTaskInputSchema", () => {
  it("accepts a valid payload", () => {
    const result = cropImageTaskInputSchema.safeParse({
      inputImageUrl: "https://example.com/image.png",
      x: 10,
      y: 20,
      width: 50,
      height: 60,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a local upload path", () => {
    const result = cropImageTaskInputSchema.safeParse({
      inputImageUrl: "/uploads/test.png",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing inputImageUrl", () => {
    const result = cropImageTaskInputSchema.safeParse({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects x > 100", () => {
    const result = cropImageTaskInputSchema.safeParse({
      inputImageUrl: "https://example.com/image.png",
      x: 101,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative y", () => {
    const result = cropImageTaskInputSchema.safeParse({
      inputImageUrl: "https://example.com/image.png",
      x: 0,
      y: -1,
      width: 50,
      height: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects width of 0", () => {
    const result = cropImageTaskInputSchema.safeParse({
      inputImageUrl: "https://example.com/image.png",
      x: 0,
      y: 0,
      width: 0,
      height: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid image URL format", () => {
    const result = cropImageTaskInputSchema.safeParse({
      inputImageUrl: "not-a-url",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(result.success).toBe(false);
  });
});
