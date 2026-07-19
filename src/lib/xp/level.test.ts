import { describe, expect, it } from "vitest";
import { cumulativeXpForLevel, levelInfoFromTotalXp } from "./level";

describe("cumulativeXpForLevel", () => {
  it("Lv.1到達に必要な累積XPは0", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
  });

  it("Lv.N→N+1に必要なXPが100×Nずつ増える累積になる", () => {
    expect(cumulativeXpForLevel(2)).toBe(100); // 1→2: 100
    expect(cumulativeXpForLevel(3)).toBe(300); // 2→3: 200 (累積300)
    expect(cumulativeXpForLevel(4)).toBe(600); // 3→4: 300 (累積600)
    expect(cumulativeXpForLevel(5)).toBe(1000); // 4→5: 400 (累積1000)
  });
});

describe("levelInfoFromTotalXp", () => {
  it("totalXp=0はLv.1、次のレベルまで100XP", () => {
    const info = levelInfoFromTotalXp(0);
    expect(info.level).toBe(1);
    expect(info.currentLevelXp).toBe(0);
    expect(info.xpForNextLevel).toBe(100);
    expect(info.xpToNextLevel).toBe(100);
  });

  it("レベル境界の直前はまだ前のレベルのまま", () => {
    const info = levelInfoFromTotalXp(99);
    expect(info.level).toBe(1);
    expect(info.currentLevelXp).toBe(99);
    expect(info.xpToNextLevel).toBe(1);
  });

  it("ちょうど境界値でレベルアップする", () => {
    const info = levelInfoFromTotalXp(100);
    expect(info.level).toBe(2);
    expect(info.currentLevelXp).toBe(0);
    expect(info.xpForNextLevel).toBe(200);
    expect(info.xpToNextLevel).toBe(200);
  });

  it("Lv.2からLv.3の境界も正しく計算する", () => {
    expect(levelInfoFromTotalXp(299).level).toBe(2);
    const info = levelInfoFromTotalXp(300);
    expect(info.level).toBe(3);
    expect(info.currentLevelXp).toBe(0);
    expect(info.xpForNextLevel).toBe(300);
  });

  it("負のtotalXpは0として扱いLv.1になる", () => {
    const info = levelInfoFromTotalXp(-50);
    expect(info.level).toBe(1);
    expect(info.currentLevelXp).toBe(0);
  });
});
