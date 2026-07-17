export type SubjectTimeSlot = "morning" | "anytime";

export interface SchedulerSubject {
  id: string;
  name: string;
  weeklyQuotaMin: number;
  /** 小さいほど優先度が高い */
  priority: number;
  timeSlot: SubjectTimeSlot;
}

export type LocationKind = "library" | "cafe" | "other";

export interface OpeningHoursRange {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

/** キー: 0=Mon..6=Sun。未定義のキーはその曜日休業。 */
export type WeeklyOpeningHours = Partial<Record<number, OpeningHoursRange>>;

export interface SchedulerLocation {
  id: string;
  name: string;
  kind: LocationKind;
  /** cafe等の最大滞在時間（分）。休憩・昼食込みの合計。未設定なら滞在時間制限なし。 */
  maxStayMin?: number;
  openingHours: WeeklyOpeningHours;
}

export interface SchedulerFixedEvent {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
  /** 指定された場合、予定終了後の移動はこの場所を起点にする */
  locationId?: string;
}

export interface SchedulerSettings {
  wakeWeekday: string; // "HH:MM"
  wakeWeekend: string; // "HH:MM"
  morningEnd: string; // "HH:MM" 例 "12:00"
  outsideEnd: string; // "HH:MM" 例 "21:00"
}

/** from/to は 出発地点ID（StartPoint.id） または locationId */
export type TravelTimeFn = (from: string, to: string) => number;

export type ScheduleBlockType = "study" | "move" | "break" | "lunch" | "event";
export type ScheduleBlockStatus = "planned" | "done" | "partial" | "skipped";

export interface ScheduleBlock {
  date: string; // "YYYY-MM-DD"
  type: ScheduleBlockType;
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
  subjectId?: string;
  locationId?: string;
  status: ScheduleBlockStatus;
  actualMin?: number;
}

export interface QuotaWarning {
  type: "quota_exceeded";
  subjectId: string;
  shortfallMin: number;
  message: string;
}

export interface GenerateWeekInput {
  weekStartDate: string; // "YYYY-MM-DD"（月曜想定）
  /** 週間生成時のデフォルト出発地点ID（StartPoint.id）。生成時点では日ごとの上書きは考慮しない。 */
  startLocationId: string;
  subjects: SchedulerSubject[];
  locations: SchedulerLocation[];
  fixedEvents: SchedulerFixedEvent[];
  settings: SchedulerSettings;
  travelTimeFn: TravelTimeFn;
  /** ローテーション用の直近使用場所（最も直近が先頭） */
  recentlyUsedLocationIds?: string[];
}

export interface GenerateWeekResult {
  blocks: ScheduleBlock[];
  warnings: QuotaWarning[];
}
