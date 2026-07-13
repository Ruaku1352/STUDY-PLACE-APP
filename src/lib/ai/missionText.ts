import { AI_MODEL, getAnthropicClient } from "./client";

export const FALLBACK_MISSION_TEXT = "今日も1日、頑張りましょう。新しい場所での勉強を楽しんでください。";

export interface MissionTextBlock {
  subjectName: string | null;
  locationName: string | null;
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
}

export interface GenerateMissionTextInput {
  blocks: MissionTextBlock[];
  streakDays: number;
}

/**
 * 開封時のスケジュール概要とストリーク日数から「本日の任務」風の演出テキストを生成する。
 * 失敗時は例外を投げる（呼び出し側でFALLBACK_MISSION_TEXTにフォールバックし、開封処理自体はブロックしない）。
 */
export async function generateMissionText(input: GenerateMissionTextInput): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 300,
    system: `あなたは勉強スケジュール管理アプリ「デイリーガチャ」の開封演出担当です。
今日のスケジュール概要とストリーク日数をもとに、ユーザーを鼓舞する「本日の任務」風の短い日本語テキストを2〜3文で生成してください。
このテキストは開封後（場所・科目が既にユーザーに見えている状態）に表示するので、場所名・科目名はそのまま使ってよいです。
堅すぎず、ゲームのミッション演出のような高揚感のある文体にしてください。前置きや見出しは不要で、本文のみを返してください。`,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude APIからミッション文を取得できませんでした");
  }

  return textBlock.text.trim();
}
