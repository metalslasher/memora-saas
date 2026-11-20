import { describe, expect, it } from "vitest";
import {
  isValidTimezone,
  validateDailyMinutes,
  validateId,
  validateReviewInput,
  validateWordStatus,
} from "./validation";

const id = "3f2a8c1e-1b2c-4d5e-8f90-123456789abc";

describe("validation", () => {
  it("accepts only UUIDs as ids", () => {
    expect(validateId(` ${id} `, "Слово")).toBe(id);
    expect(() => validateId("note-1", "Слово")).toThrow("Слово не знайдено.");
  });

  it("validates review input", () => {
    expect(validateReviewInput({ cardId: id, rating: "good", responseText: "  hi ", elapsedMs: 99_999_999 })).toEqual({
      cardId: id,
      rating: "good",
      responseText: "hi",
      elapsedMs: 30 * 60_000,
    });
    expect(() => validateReviewInput({ cardId: id, rating: "meh" as never, responseText: "", elapsedMs: 1 })).toThrow();
    expect(() => validateReviewInput({ cardId: id, rating: "good", responseText: "", elapsedMs: -1 })).toThrow();
  });

  it("validates statuses and daily minutes", () => {
    expect(validateWordStatus("paused")).toBe("paused");
    expect(() => validateWordStatus("suspended")).toThrow();
    expect(validateDailyMinutes(20)).toBe(20);
    expect(() => validateDailyMinutes(25)).toThrow();
    expect(() => validateDailyMinutes("15")).toThrow();
  });

  it("checks timezones", () => {
    expect(isValidTimezone("Europe/Kyiv")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});
