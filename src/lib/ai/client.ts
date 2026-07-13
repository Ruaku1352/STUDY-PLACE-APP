import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

/** ANTHROPIC_API_KEY からクライアントを遅延生成する。未設定の場合は呼び出し時にSDKがエラーを投げる。 */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
