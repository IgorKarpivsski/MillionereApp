/**
 * Which reminders to schedule, decided from what the app already knows.
 * Pure (no Expo imports) so it is unit-tested; useReminders() schedules the result.
 * Rules: at most one reminder per kind, nothing in the next 5 minutes, nothing
 * between 22:00 and 09:00 Israel time (quiet hours: pushed to 09:00).
 */
export interface ReminderInput {
  now: Date;
  wheelNextFreeAt: string | null | undefined;
  wheelFree: boolean | undefined;
  dailyState: 'open' | 'in_progress' | 'done' | undefined;
  streak: number;
  secondsToReset: number | undefined;
  energy: { tickets: number; max: number; next_at: string | null; refill_minutes: number; unlimited: boolean } | undefined;
  /** Tomorrow's daily gift, already worded ("חבילת כסף"), when known. */
  tomorrowGift?: string;
}

export interface Reminder {
  id: 'wheel' | 'streak' | 'daily' | 'gift' | 'energy' | 'comeback2' | 'comeback5';
  at: Date;
  title: string;
  body: string;
}

const MIN_LEAD_MS = 5 * 60_000;
/** Last Sunday of a month (UTC date), month 0-based. */
function lastSunday(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/**
 * Israel's UTC offset in minutes: summer time (UTC+3) from the Friday before the last
 * Sunday of March, 02:00, until the last Sunday of October, 02:00; otherwise UTC+2.
 */
export function ilOffsetMin(d: Date): number {
  const y = d.getUTCFullYear();
  const start = lastSunday(y, 2);
  start.setUTCDate(start.getUTCDate() - 2); // Friday
  const startAt = start.getTime(); // 02:00 local winter = 00:00 UTC
  const endAt = lastSunday(y, 9).getTime() - 3600_000; // 02:00 local summer = 23:00 UTC the day before
  const t = d.getTime();
  return t >= startAt && t < endAt ? 180 : 120;
}

function ilHour(d: Date): number {
  return (d.getUTCHours() + d.getUTCMinutes() / 60 + ilOffsetMin(d) / 60) % 24;
}

/** Tomorrow at hh:mm Israel time. */
function ilTomorrowAt(now: Date, hh: number, mm: number): Date {
  const off = ilOffsetMin(now);
  const local = new Date(now.getTime() + off * 60_000);
  const at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, hh, mm) - off * 60_000;
  return new Date(at);
}

/** Moves a time out of quiet hours (22:00–09:00) to the next 09:00. */
export function outOfQuietHours(d: Date): Date {
  const h = ilHour(d);
  if (h >= 9 && h < 22) return d;
  const off = ilOffsetMin(d);
  const local = new Date(d.getTime() + off * 60_000);
  const addDays = h >= 22 ? 1 : 0;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + addDays, 9, 0) - off * 60_000);
}

export function planReminders(i: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  const now = i.now.getTime();
  const push = (r: Reminder) => {
    const at = outOfQuietHours(r.at);
    if (at.getTime() - now >= MIN_LEAD_MS) out.push({ ...r, at });
  };

  if (!i.wheelFree && i.wheelNextFreeAt) {
    push({ id: 'wheel', at: new Date(i.wheelNextFreeAt), title: 'הגלגל החינמי מחכה לך', body: 'סיבוב אחד בחינם — אולי הפעם יהלומים?' });
  }

  if (i.secondsToReset != null) {
    const reset = now + i.secondsToReset * 1000;
    if (i.dailyState !== 'done') {
      // Two hours before the day ends — but not in quiet hours (then: early evening).
      let at = new Date(reset - 2 * 3600_000);
      if (ilHour(at) >= 22 || ilHour(at) < 9) at = new Date(reset - 4 * 3600_000);
      if (i.streak > 0) {
        push({ id: 'streak', at, title: `הרצף של ${i.streak} ימים בסכנה!`, body: 'עוד לא שיחקת את האתגר היומי. 10 שאלות והרצף ממשיך.' });
      } else {
        push({ id: 'daily', at, title: 'האתגר היומי עוד פתוח', body: '10 שאלות נגד האלוף. מצליח לנצח היום?' });
      }
    }
  }

  // Tomorrow after school: the daily gift (and a new daily challenge) is waiting.
  // Re-planned every time the app goes to the background, so it always means "the day after the last visit".
  const gift = i.tomorrowGift ? `מחכה לך ${i.tomorrowGift}` : 'המתנה היומית שלך מחכה';
  push({
    id: 'gift',
    at: ilTomorrowAt(i.now, 16, 30),
    title: 'המתנה של היום מוכנה 🎁',
    body: i.dailyState === 'done' ? `${gift}, ואתגר יומי חדש כבר פתוח.` : `${gift}. בוא לאסוף!`,
  });

  // Haven't opened the app in a while: a nudge after 2 days, another after 5.
  // Every time the app goes to the background these move forward, so active players never see them.
  push({ id: 'comeback2', at: new Date(now + 2 * 86_400_000), title: 'האלוף מתגעגע אליך 🦥', body: 'שאלות חדשות מחכות לך, והפרס היומי עוד לא נאסף.' });
  push({ id: 'comeback5', at: new Date(now + 5 * 86_400_000), title: 'מזמן לא ראינו אותך!', body: 'חזור לשחק, יש לך מתנה שמחכה בפנים.' });

  const e = i.energy;
  if (e && !e.unlimited && e.tickets < e.max && e.next_at) {
    const full = new Date(e.next_at).getTime() + (e.max - e.tickets - 1) * e.refill_minutes * 60_000;
    push({ id: 'energy', at: new Date(full), title: 'הכרטיסים התמלאו', body: 'יש לך שוב כרטיסים מלאים למשחק הקלאסי.' });
  }
  return out;
}
