export interface RevealWeatherBlock {
  time: string; // "HH:MM"
  weatherCode: number;
  temperatureC: number;
  precipitationProbability: number;
}

export interface RevealWeather {
  maxTempC: number;
  minTempC: number;
  maxPrecipitationProbability: number;
  isRainy: boolean;
  /** 起床時刻を含む3時間区切り〜21:00までのコマ。 */
  blocks: RevealWeatherBlock[];
}

/**
 * 開封演出を即座に表示するための結果。ミッション文（AI生成）・天気（外部API）は
 * ここには含めず、開封演出をブロックしないよう別途 fetchMissionTextForToday /
 * fetchWeatherForToday で並行して取得し、解決ししだいカードへ差し込む。
 */
export interface RevealResult {
  /** 本日訪れる場所名（重複除去・登場順）。開封後のカード演出でのみ使う。 */
  locationNames: string[];
  totalStudyMin: number;
  /** 雨の日ルール（近場優先の重み付け抽選）が発動して場所選びに反映されたか。 */
  rainRuleApplied: boolean;
}
