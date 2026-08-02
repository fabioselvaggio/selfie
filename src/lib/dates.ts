/**
 * Giorni, streak e traguardi.
 *
 * Un "giorno" non finisce necessariamente a mezzanotte: con `cutoffHour = 4`
 * uno scatto fatto alle 2:30 di notte conta ancora per il giorno prima. Senza
 * questo, chi si fa il selfie tornando a casa tardi perde lo streak pur avendo
 * fatto la foto — è il caso limite più antipatico di tutta l'app.
 */

export type DayKey = string // YYYY-MM-DD

export const MS_DAY = 86_400_000

export function toDayKey(date: Date, cutoffHour = 0): DayKey {
  const shifted = new Date(date.getTime() - cutoffHour * 3600_000)
  const y = shifted.getFullYear()
  const m = `${shifted.getMonth() + 1}`.padStart(2, '0')
  const d = `${shifted.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(cutoffHour = 0): DayKey {
  return toDayKey(new Date(), cutoffHour)
}

export function addDays(key: DayKey, delta: number): DayKey {
  const d = fromDayKey(key)
  d.setDate(d.getDate() + delta)
  return toDayKey(d)
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / MS_DAY)
}

const MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]

export function monthName(month: number): string {
  return MONTHS[month]
}

/** Formato compatto tipo 13/7/2026, come nel riferimento visivo. */
export function formatDay(key: DayKey): string {
  const d = fromDayKey(key)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

export function formatLong(key: DayKey): string {
  const d = fromDayKey(key)
  return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`
}

// ---------------------------------------------------------------- streak

export interface StreakInfo {
  /** Giorni consecutivi fino a oggi (o fino a ieri se oggi non hai ancora scattato). */
  current: number
  /** Record storico. */
  best: number
  /** Oggi è già fatto? */
  doneToday: boolean
  /** Lo streak è "in bilico": ieri fatto, oggi no. */
  atRisk: boolean
  total: number
}

export function computeStreak(days: DayKey[], today: DayKey): StreakInfo {
  const set = new Set(days)
  const sorted = [...set].sort()
  const doneToday = set.has(today)

  let current = 0
  let cursor = doneToday ? today : addDays(today, -1)
  while (set.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }

  let best = 0
  let run = 0
  let prev: DayKey | null = null
  for (const day of sorted) {
    run = prev && daysBetween(prev, day) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }

  return {
    current,
    best: Math.max(best, current),
    doneToday,
    atRisk: !doneToday && current > 0,
    total: set.size,
  }
}

// ---------------------------------------------------------------- traguardi

export interface Badge {
  days: number
  label: string
  emoji: string
}

export const BADGES: Badge[] = [
  { days: 3, label: 'Si comincia', emoji: '🌱' },
  { days: 7, label: 'Una settimana', emoji: '🔥' },
  { days: 14, label: 'Due settimane', emoji: '⚡️' },
  { days: 30, label: 'Un mese', emoji: '🌙' },
  { days: 60, label: 'Due mesi', emoji: '💪' },
  { days: 100, label: 'Cento giorni', emoji: '💎' },
  { days: 200, label: 'Duecento', emoji: '👑' },
  { days: 365, label: 'Un anno intero', emoji: '🏆' },
]

export function nextBadge(best: number): Badge | null {
  return BADGES.find((b) => b.days > best) ?? null
}

export function unlockedBadges(best: number): Badge[] {
  return BADGES.filter((b) => b.days <= best)
}
