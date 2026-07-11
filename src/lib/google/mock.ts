/** 開発用モック切り替え。true のとき Routes/Places API を一切呼ばず固定値を返す。 */
export function isMockGoogleApiEnabled(): boolean {
  return process.env.MOCK_GOOGLE_API === "true";
}

export const MOCK_TRAVEL_MINUTES = 15;

export const MOCK_OPEN_TIME = "09:00";
export const MOCK_CLOSE_TIME = "21:00";
