import { describe, expect, it } from "vitest";
import { generateRandomInitialProposal, type ProposalSubjectMeta } from "./weeklyProposal";

const subjects: ProposalSubjectMeta[] = [
  { id: "math", name: "数学", weeklyQuotaMin: 300, timeSlot: "morning" },
  { id: "eng", name: "英語", weeklyQuotaMin: 200, timeSlot: "anytime" },
];

describe("generateRandomInitialProposal", () => {
  it("confidenceは常にprovisional、タグは変更しない", () => {
    const result = generateRandomInitialProposal(subjects, () => 0.5);
    expect(result.confidence).toBe("provisional");
    expect(result.subjects.every((s) => s.timeSlotChange === "no_change")).toBe(true);
  });

  it("randomFnが0.5（中央値）ならノルマは変化しない", () => {
    const result = generateRandomInitialProposal(subjects, () => 0.5);
    const math = result.subjects.find((s) => s.subjectId === "math")!;
    expect(math.proposedQuotaMin).toBe(300);
  });

  it("randomFnが1に近いほどノルマは増加方向、0に近いほど減少方向になる", () => {
    const increased = generateRandomInitialProposal(subjects, () => 1);
    const decreased = generateRandomInitialProposal(subjects, () => 0);
    const mathIncreased = increased.subjects.find((s) => s.subjectId === "math")!;
    const mathDecreased = decreased.subjects.find((s) => s.subjectId === "math")!;
    expect(mathIncreased.proposedQuotaMin).toBeGreaterThan(300);
    expect(mathDecreased.proposedQuotaMin).toBeLessThan(300);
  });

  it("最低30分は下回らない", () => {
    const tiny: ProposalSubjectMeta[] = [{ id: "s", name: "少", weeklyQuotaMin: 20, timeSlot: "anytime" }];
    const result = generateRandomInitialProposal(tiny, () => 0);
    expect(result.subjects[0].proposedQuotaMin).toBeGreaterThanOrEqual(30);
  });

  it("全科目に理由付きの提案が含まれる", () => {
    const result = generateRandomInitialProposal(subjects, () => 0.3);
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects.every((s) => s.reason.length > 0)).toBe(true);
  });

  it("残り日数が7未満なら、その割合でノルマを控えめに縮小する", () => {
    // 残り3.5日相当(半分)、randomFn=0.5で変動なしのケース
    const result = generateRandomInitialProposal(subjects, () => 0.5, 3.5);
    const math = result.subjects.find((s) => s.subjectId === "math")!;
    expect(math.proposedQuotaMin).toBeLessThan(300);
    expect(math.proposedQuotaMin).toBeCloseTo(150, -1);
  });

  it("残り日数を省略した場合は7日分（縮小なし）として扱う", () => {
    const result = generateRandomInitialProposal(subjects, () => 0.5);
    const math = result.subjects.find((s) => s.subjectId === "math")!;
    expect(math.proposedQuotaMin).toBe(300);
  });
});
