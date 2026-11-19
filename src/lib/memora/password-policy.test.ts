import { describe, expect, it } from "vitest";
import { validatePassword } from "./password-policy";

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("abc12")).toMatch(/8 символів/);
  });

  it("requires a letter and a digit", () => {
    expect(validatePassword("12345678")).toMatch(/літеру/);
    expect(validatePassword("abcdefgh")).toMatch(/цифру/);
  });

  it("accepts letters plus digits, including Cyrillic", () => {
    expect(validatePassword("abcdefg1")).toBeNull();
    expect(validatePassword("пароль123")).toBeNull();
  });
});
