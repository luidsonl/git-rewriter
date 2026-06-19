export function parseUnixTimestamp(raw: string): number {
  const parts = raw.split(' ');
  return parseInt(parts[0], 10);
}

export function parseTzOffset(tz: string): number {
  const sign = tz.startsWith('-') ? -1 : 1;
  const digits = tz.replace(/^[+-]/, '');
  return sign * ((parseInt(digits.slice(0, 2), 10) || 0) * 3600 + (parseInt(digits.slice(2, 4), 10) || 0) * 60);
}

export function parseTimezoneOffset(raw: string): number {
  const parts = raw.split(' ');
  const off = parts[1] || '+0000';
  return parseTzOffset(off);
}

export function extractTz(raw: string): string {
  const parts = raw.split(' ');
  return parts[1] || '+0000';
}

export function displayInTimezone(secs: number, tzOffsetSecs: number) {
  const d = new Date((secs + tzOffsetSecs) * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

export function formatDate(raw: string): string {
  const secs = parseUnixTimestamp(raw);
  if (isNaN(secs)) return raw;
  const tzOffset = parseTimezoneOffset(raw);
  const d = new Date((secs + tzOffset) * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function parseDateFields(raw: string): { date: string; time: string; tz: string } {
  const secs = parseUnixTimestamp(raw);
  if (isNaN(secs)) return { date: '', time: '', tz: '+0000' };
  const tz = extractTz(raw);
  const tzOffset = parseTimezoneOffset(raw);
  const { date, time } = displayInTimezone(secs, tzOffset);
  return { date, time, tz };
}

export function rawToUtcSecs(raw: string): number {
  return parseUnixTimestamp(raw);
}

export function normalizeTz(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^[+-]\d{4}$/.test(s)) return s;
  if (/^[+-]\d{2}:\d{2}$/.test(s)) return s.slice(0, 3) + s.slice(4);
  if (/^\d{4}$/.test(s)) return `+${s}`;
  const m = s.match(/^([+-])?(\d{1,2})(?::(\d{2}))?$/);
  if (m) {
    const sign = m[1] || '+';
    const h = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3], 10) : 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${sign}${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}`;
    }
  }
  return null;
}

export function combineDateFields(dateStr: string, timeStr: string, tzStr: string, originalRaw: string, origParsed: { date: string; time: string; tz: string }): string {
  if (!dateStr) return originalRaw;
  if (dateStr === origParsed.date && timeStr === origParsed.time && tzStr === origParsed.tz) {
    return originalRaw;
  }
  const norm = normalizeTz(tzStr);
  if (!norm) return originalRaw;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  if (isNaN(utcMs)) return originalRaw;
  const tzSecs = parseTzOffset(norm);
  const secs = Math.floor(utcMs / 1000) - tzSecs;
  return `${secs} ${norm}`;
}
