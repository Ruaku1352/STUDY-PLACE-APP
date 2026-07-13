import { AI_MODEL, getAnthropicClient } from "./client";
import type { WeeklyReviewInput } from "./weeklyReview";

export interface ProposalSubjectMeta {
  id: string;
  name: string;
  weeklyQuotaMin: number;
  timeSlot: "morning" | "anytime";
}

export interface SubjectProposal {
  subjectId: string;
  proposedQuotaMin: number;
  timeSlotChange: "morning" | "anytime" | "no_change";
  reason: string;
}

export interface WeeklyProposal {
  overallComment: string;
  confidence: "provisional" | "established";
  subjects: SubjectProposal[];
}

const WEEKLY_PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    overallComment: { type: "string" },
    confidence: { type: "string", enum: ["provisional", "established"] },
    subjects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subjectId: { type: "string" },
          proposedQuotaMin: { type: "integer" },
          timeSlotChange: { type: "string", enum: ["morning", "anytime", "no_change"] },
          reason: { type: "string" },
        },
        required: ["subjectId", "proposedQuotaMin", "timeSlotChange", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["overallComment", "confidence", "subjects"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `あなたは勉強スケジュール管理アプリの週次レビューアシスタントです。
直近数週間の実績データをもとに、来週のノルマ（分/週）とタグ（morning/anytime）の変更案を科目ごとに1つずつ提案してください。

方針:
- ノルマを勝手に大きく増やしすぎないこと。達成率が高い科目でも増加は緩やかに。
- 未達（achievementRateが低い）が続く科目は、無理をさせずノルマを減らす方向を優先すること。
- 変更が不要と判断した科目は proposedQuotaMin を現在値のまま、timeSlotChange は "no_change" とし、その旨を理由に明記すること。
- confidence は weeksObserved が2週未満なら "provisional"、それ以上なら "established" とすること。
- reason は日本語で1〜2文の簡潔な説明にすること。
- overallComment は先週の振り返りを踏まえた全体コメント（2〜3文、日本語）にすること。`;

/** 週次実績データをClaude APIに渡し、来週のノルマ提案をJSONで受け取る。 */
export async function generateWeeklyProposal(
  input: WeeklyReviewInput,
  subjects: ProposalSubjectMeta[],
): Promise<WeeklyProposal> {
  const client = getAnthropicClient();

  const userPayload = {
    weeksObserved: input.weeksObserved,
    blocksObserved: input.blocksObserved,
    rerollCount: input.rerollCount,
    giveUpCount: input.giveUpCount,
    subjects: input.subjects.map((s) => {
      const meta = subjects.find((m) => m.id === s.subjectId);
      return {
        subjectId: s.subjectId,
        name: s.name,
        currentQuotaMin: s.quotaMin,
        currentTimeSlot: meta?.timeSlot ?? "anytime",
        actualMinPerWeekAvg: input.weeksObserved > 0 ? Math.round(s.actualMin / input.weeksObserved) : 0,
        achievementRate: Math.round(s.achievementRate * 100) / 100,
        morningMissRate: s.morningMissRate === null ? null : Math.round(s.morningMissRate * 100) / 100,
      };
    }),
  };

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: WEEKLY_PROPOSAL_SCHEMA } },
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude APIから提案テキストを取得できませんでした");
  }

  return JSON.parse(textBlock.text) as WeeklyProposal;
}
