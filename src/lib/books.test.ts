import { describe, expect, it } from "vitest";
import { calcBookProgress } from "./books";

describe("calcBookProgress", () => {
  it("totalPagesが未設定なら未制覇・0%を返す", () => {
    expect(calcBookProgress(null, 50)).toEqual({ percent: 0, completed: false });
  });

  it("途中までの進捗を割合で返す", () => {
    expect(calcBookProgress(200, 100)).toEqual({ percent: 50, completed: false });
  });

  it("totalPagesに到達したら制覇と判定する", () => {
    expect(calcBookProgress(200, 200)).toEqual({ percent: 100, completed: true });
  });

  it("読んだページがtotalPagesを超えても100%でクランプする", () => {
    expect(calcBookProgress(200, 250)).toEqual({ percent: 100, completed: true });
  });
});
