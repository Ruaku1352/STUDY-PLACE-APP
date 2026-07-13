import { AI_MODEL, getAnthropicClient } from "./client";

export type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface BookInfoDraft {
  title: string;
  publisher: string | null;
  totalPages: number | null;
  subjectId: string | null;
}

const BOOK_INFO_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    publisher: { anyOf: [{ type: "string" }, { type: "null" }] },
    totalPages: { anyOf: [{ type: "integer" }, { type: "null" }] },
    subjectId: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["title", "publisher", "totalPages", "subjectId"],
  additionalProperties: false,
} as const;

/**
 * 参考書の表紙画像からタイトル・出版社・推定総ページ数・最も近い科目を抽出する。
 * 失敗時は例外を投げる（呼び出し側でUIに「AI解析に失敗しました」を表示し、手動入力にフォールバックする）。
 */
export async function extractBookInfo(
  imageBase64: string,
  mediaType: SupportedImageMediaType,
  existingSubjects: { id: string; name: string }[],
): Promise<BookInfoDraft> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: `あなたは参考書の表紙画像から書誌情報を抽出するアシスタントです。
タイトル・出版社・推定総ページ数（実物で確認できないため不明ならnull）・登録済み科目の中から最も近いものをJSONで返してください。
科目候補: ${existingSubjects.map((s) => `${s.id}:${s.name}`).join(", ") || "（登録済み科目なし）"}
該当する科目が無ければ subjectId は null にしてください。`,
    output_config: { format: { type: "json_schema", schema: BOOK_INFO_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "この参考書の表紙から書誌情報を抽出してください。" },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude APIから抽出結果を取得できませんでした");
  }

  return JSON.parse(textBlock.text) as BookInfoDraft;
}
