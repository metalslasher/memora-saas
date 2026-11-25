import { describe, expect, it } from "vitest";
import {
  isValidReminderWindow,
  pickReminderRecipients,
  reminderText,
  reminderWordCount,
  type ReminderCandidate,
} from "./reminders";

const candidate: ReminderCandidate = {
  userId: "u1",
  timezone: "Europe/Kyiv",
  start: 19,
  end: 22,
  lastReminderDay: null,
  dailyMinutes: 15,
  metDays: [],
  dueWords: 10,
  newReady: 6,
};
// 17:00Z = 19:00 in Kyiv (UTC+2) on 2026-11-25.
const at19 = new Date("2026-11-25T17:00:00Z");

describe("pickReminderRecipients", () => {
  it("picks a user inside the window with work to do", () => {
    const [picked] = pickReminderRecipients([candidate], at19);
    expect(picked).toMatchObject({ userId: "u1", day: "2026-11-25" });
    expect(picked.count).toBeGreaterThan(10);
  });

  it("uses the learner's own timezone, not UTC", () => {
    const la = { ...candidate, timezone: "America/Los_Angeles" };
    // 17:00Z is 09:00 in Los Angeles: outside the 19–22 window.
    expect(pickReminderRecipients([la], at19)).toEqual([]);
    // 03:00Z next day is 19:00 the day before in Los Angeles (UTC-8).
    const evening = pickReminderRecipients([la], new Date("2026-11-26T03:00:00Z"));
    expect(evening.map((item) => item.day)).toEqual(["2026-11-25"]);
  });

  it("includes the start hour and excludes the end hour", () => {
    expect(pickReminderRecipients([candidate], new Date("2026-11-25T16:59:00Z"))).toEqual([]);
    expect(pickReminderRecipients([candidate], new Date("2026-11-25T19:59:00Z"))).toHaveLength(1); // 21:59
    expect(pickReminderRecipients([candidate], new Date("2026-11-25T20:00:00Z"))).toEqual([]); // 22:00
  });

  it("sends at most once per local day", () => {
    expect(pickReminderRecipients([{ ...candidate, lastReminderDay: "2026-11-25" }], at19)).toEqual([]);
    expect(pickReminderRecipients([{ ...candidate, lastReminderDay: "2026-11-24" }], at19)).toHaveLength(1);
  });

  it("stays silent when today's goal is already met", () => {
    expect(pickReminderRecipients([{ ...candidate, metDays: ["2026-11-25"] }], at19)).toEqual([]);
    // yesterday's goal does not silence today
    expect(pickReminderRecipients([{ ...candidate, metDays: ["2026-11-24"] }], at19)).toHaveLength(1);
  });

  it("stays silent when nothing is waiting", () => {
    expect(pickReminderRecipients([{ ...candidate, dueWords: 0, newReady: 0 }], at19)).toEqual([]);
  });

  it("handles a window that ends at midnight", () => {
    const late = { ...candidate, start: 22, end: 24 };
    expect(pickReminderRecipients([late], new Date("2026-11-25T21:30:00Z"))).toHaveLength(1); // 23:30
    expect(pickReminderRecipients([late], new Date("2026-11-25T22:30:00Z"))).toEqual([]); // 00:30 next day
  });
});

describe("reminder text and window", () => {
  it("counts due reviews plus the new words today's pace allows", () => {
    // Many reviews leave no room for new words.
    expect(reminderWordCount({ dueWords: 75, newReady: 10, dailyMinutes: 15 })).toBe(75);
    expect(reminderWordCount({ dueWords: 0, newReady: 3, dailyMinutes: 15 })).toBe(3);
  });

  it("writes short Ukrainian text with the right plural", () => {
    expect(reminderText(1).body).toContain("1 слово");
    expect(reminderText(3).body).toContain("3 слова");
    expect(reminderText(11).body).toContain("11 слів");
    expect(reminderText(21).body).toContain("21 слово");
  });

  it("validates the window", () => {
    expect(isValidReminderWindow(19, 22)).toBe(true);
    expect(isValidReminderWindow(22, 24)).toBe(true);
    expect(isValidReminderWindow(22, 22)).toBe(false);
    expect(isValidReminderWindow(23, 20)).toBe(false);
    expect(isValidReminderWindow(-1, 5)).toBe(false);
    expect(isValidReminderWindow(5, 25)).toBe(false);
    expect(isValidReminderWindow(5.5, 8)).toBe(false);
    expect(isValidReminderWindow("5", 8)).toBe(false);
  });
});
