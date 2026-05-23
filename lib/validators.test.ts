import { describe, expect, it } from "vitest";
import { sendMessageSchema, signInSchema } from "./validators";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "secret-pw",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "secret-pw",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendMessageSchema", () => {
  it("trims surrounding whitespace and accepts non-empty text", () => {
    const result = sendMessageSchema.safeParse({ text: "  hello  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("hello");
    }
  });

  it("rejects whitespace-only input", () => {
    expect(sendMessageSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("rejects input longer than 2000 characters", () => {
    expect(sendMessageSchema.safeParse({ text: "x".repeat(2001) }).success).toBe(
      false,
    );
  });
});
