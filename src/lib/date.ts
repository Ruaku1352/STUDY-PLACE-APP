/** サーバーのローカル日付を "YYYY-MM-DD" で返す */
export function todayDateString(): string {
  return dateToDateString(new Date());
}

export function dateToDateString(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateToHHMM(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "YYYY-MM-DD" をその日の 00:00（ローカル時刻）の Date にする */
export function dateStringToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** "YYYY-MM-DD" + "HH:MM" をローカル時刻の Date にする */
export function combineDateAndTime(dateStr: string, hhmm: string): Date {
  return new Date(`${dateStr}T${hhmm}:00`);
}
