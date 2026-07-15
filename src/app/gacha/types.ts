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

export interface RevealResult {
  missionText: string;
  /** 本日訪れる場所名（重複除去・登場順）。開封後のカード演出でのみ使う。 */
  locationNames: string[];
  totalStudyMin: number;
  /** 天気予報。自宅座標未設定・取得失敗時はnull（天気なしの通常フロー）。 */
  weather: RevealWeather | null;
  /** 雨の日ルール（近場優先の重み付け抽選）が発動して場所選びに反映されたか。 */
  rainRuleApplied: boolean;
}
