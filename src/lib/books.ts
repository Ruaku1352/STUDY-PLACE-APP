export interface BookProgress {
  /** 0〜100（totalPagesが未設定なら0） */
  percent: number;
  completed: boolean;
}

/** 参考書の進捗率と制覇判定を計算する純粋関数。totalPagesが未設定・0以下ならpercent=0・未制覇として扱う。 */
export function calcBookProgress(totalPages: number | null, maxPageRead: number): BookProgress {
  if (!totalPages || totalPages <= 0) {
    return { percent: 0, completed: false };
  }
  const clamped = Math.max(0, Math.min(maxPageRead, totalPages));
  const percent = Math.round((clamped / totalPages) * 100);
  return { percent, completed: clamped >= totalPages };
}
