/** 分数を「○時間○分」形式の表示用文字列に変換する（DB上は分単位のまま扱う）。 */
export function formatMinutesAsHM(totalMin: number): string {
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}
