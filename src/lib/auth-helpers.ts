export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeStudentCode(code: string): string {
  return code.trim();
}

export function looksLikeEmail(identifier: string): boolean {
  return identifier.trim().includes("@");
}

/**
 * Validates and normalizes HH:MM or HH:MM:SS into canonical Postgres TIME "HH:MM:00".
 * Supports 24:00 only if normalized to 23:59:00? Wait: cross-midnight is rejected cleanly;
 * 00:00 through 23:59 are valid day times in 1-minute resolution.
 */
export function normalizeTimeString(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error("صيغة الوقت غير صالحة (المطلوب HH:MM)");
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h === 24 && m === 0) {
    return "23:59:00";
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error("قيمة الساعة أو الدقيقة خارج النطاق الصالح (00:00 – 23:59)");
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function parseTimeToMinutes(timeStr: string | null | undefined, fallbackHour = 8): number {
  if (!timeStr) return fallbackHour * 60;
  const match = /^(\d{1,2}):(\d{2})/.exec(timeStr.trim());
  if (!match) return fallbackHour * 60;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h === 24 && m === 0) return 24 * 60;
  return h * 60 + m;
}

export function formatTimeDisplay(timeStr: string | null | undefined, fallbackHour?: number): string {
  if (!timeStr) {
    const h = fallbackHour ?? 8;
    return `${String(h).padStart(2, "0")}:00`;
  }
  const match = /^(\d{1,2}):(\d{2})/.exec(timeStr.trim());
  if (!match) return timeStr;
  return `${match[1]!.padStart(2, "0")}:${match[2]!}`;
}
