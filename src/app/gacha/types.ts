export interface RevealResult {
  missionText: string;
  /** 本日訪れる場所名（重複除去・登場順）。開封後のカード演出でのみ使う。 */
  locationNames: string[];
  totalStudyMin: number;
}
