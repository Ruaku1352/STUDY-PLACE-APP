import { describe, expect, it } from "vitest";
import { formatMinutesAsHM } from "./formatMinutes";

describe("formatMinutesAsHM", () => {
  it("returns just minutes when under an hour", () => {
    expect(formatMinutesAsHM(45)).toBe("45分");
    expect(formatMinutesAsHM(0)).toBe("0分");
  });

  it("omits minutes when exactly on the hour", () => {
    expect(formatMinutesAsHM(60)).toBe("1時間");
    expect(formatMinutesAsHM(300)).toBe("5時間");
  });

  it("shows both hours and minutes otherwise", () => {
    expect(formatMinutesAsHM(90)).toBe("1時間30分");
    expect(formatMinutesAsHM(313)).toBe("5時間13分");
  });
});
