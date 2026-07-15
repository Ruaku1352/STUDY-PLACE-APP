/** Open-Meteo の1時間ごとの生データ1点分。 */
export interface HourlyWeatherPoint {
  time: string; // "HH:MM"
  weatherCode: number;
  temperatureC: number;
  precipitationProbability: number; // 0-100
}

/** 開封カードに表示する3時間ごとの1コマ分。 */
export interface WeatherBlock3h {
  time: string; // コマ開始時刻 "HH:MM"
  weatherCode: number;
  temperatureC: number;
  precipitationProbability: number; // 0-100（区間内の最大値）
}

/** 開封カード上部に表示する当日の天気サマリー。 */
export interface WeatherSummary {
  maxTempC: number;
  minTempC: number;
  /** 出発(起床)〜21:00の日中の最大降水確率。 */
  maxPrecipitationProbability: number;
  /** 日中の最大降水確率が閾値以上かどうか。 */
  isRainy: boolean;
}
