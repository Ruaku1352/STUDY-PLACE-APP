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
- overallComment は先週の振り返りを踏まえた全体コメント（2〜3文、日本語）にすること。
- 入力の remainingDaysInWeek が7未満の場合、週の途中からの設定であることを意味する。
  proposedQuotaMinは7日分ではなくremainingDaysInWeek日分の現実的な量にすること
  （目安: 通常の提案値 × remainingDaysInWeek/7 程度。無理に7日分の量を残り日数に詰め込まないこと）。`;

/** 週次実績データをClaude APIに渡し、来週のノルマ提案をJSONで受け取る。remainingDaysInWeekは対象週の残り日数（通常7、週の途中の設定なら7未満）。 */
export async function generateWeeklyProposal(
  input: WeeklyReviewInput,
  subjects: ProposalSubjectMeta[],
  remainingDaysInWeek = 7,
): Promise<WeeklyProposal> {
  const client = getAnthropicClient();

  const userPayload = {
    weeksObserved: input.weeksObserved,
    blocksObserved: input.blocksObserved,
    rerollCount: input.rerollCount,
    giveUpCount: input.giveUpCount,
    remainingDaysInWeek,
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

const RANDOM_QUOTA_VARIATION_RATIO = 0.15;
const MIN_RANDOM_QUOTA_MIN = 30;

/**
 * 実績データが1週間も無い初回用の提案を、AIを呼ばずにランダムに生成する純粋関数。
 * ノルマは現在値の±15%の範囲でランダムに揺らす（ガチャらしい遊び要素として）。
 * タグ（morning/anytime）は変更しない。乱数はMath.randomではなくrandomFnとして注入可能にし、テスト容易性を確保する。
 * remainingDaysInWeekが7未満（週の途中の設定）の場合、その割合でノルマを控えめに縮小する。
 */
export function generateRandomInitialProposal(
  subjects: ProposalSubjectMeta[],
  randomFn: () => number = Math.random,
  remainingDaysInWeek = 7,
): WeeklyProposal {
  const scale = Math.min(1, remainingDaysInWeek / 7);
  return {
    overallComment:
      "まだ実績データが無いため、今回はAI分析ではなくランダムに初回のノルマを作成しました。数値はあくまで参考です。来週以降、実績が貯まるとAIが分析して提案します。",
    confidence: "provisional",
    subjects: subjects.map((s) => {
      const variation = 1 + (randomFn() * 2 - 1) * RANDOM_QUOTA_VARIATION_RATIO;
      const proposedQuotaMin = Math.max(MIN_RANDOM_QUOTA_MIN, Math.round((s.weeklyQuotaMin * scale * variation) / 5) * 5);
      return {
        subjectId: s.id,
        proposedQuotaMin,
        timeSlotChange: "no_change",
        reason:
          scale < 1
            ? "実績データが無いため、残り日数に合わせて現在のノルマを縮小してランダムに設定しました。"
            : "実績データが無いため、現在のノルマを基準にランダムに設定しました。",
      };
    }),
  };
}
