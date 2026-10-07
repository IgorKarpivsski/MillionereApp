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
}

export interface Reminder {
  id: 'wheel' | 'streak' | 'daily' | 'energy';
  at: Date;
  title: string;
  body: string;
}

const MIN_LEAD_MS = 5 * 60_000;
const IL_OFFSET_MIN = 180; // Israel summer time; winter is 120. Quiet hours tolerate the hour of drift.

function ilHour(d: Date): number {
  return (d.getUTCHours() + IL_OFFSET_MIN / 60) % 24;
}

/** Moves a time out of quiet hours (22:00–09:00) to the next 09:00. */
export function outOfQuietHours(d: Date): Date {
  const h = ilHour(d);
  if (h >= 9 && h < 22) return d;
  const out = new Date(d);
  const addDays = h >= 22 ? 1 : 0;
  out.setUTCDate(out.getUTCDate() + addDays);
  out.setUTCHours(9 - IL_OFFSET_MIN / 60, 0, 0, 0);
  return out;
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
    } else {
      push({ id: 'daily', at: new Date(reset + 9 * 3600_000), title: 'אתגר יומי חדש!', body: `שמור על הרצף${i.streak > 0 ? ` של ${i.streak} ימים` : ''} — האלוף כבר מחכה.` });
    }
  }

  const e = i.energy;
  if (e && !e.unlimited && e.tickets < e.max && e.next_at) {
    const full = new Date(e.next_at).getTime() + (e.max - e.tickets - 1) * e.refill_minutes * 60_000;
    push({ id: 'energy', at: new Date(full), title: 'הכרטיסים התמלאו', body: 'יש לך שוב כרטיסים מלאים למשחק הקלאסי.' });
  }
  return out;
}
