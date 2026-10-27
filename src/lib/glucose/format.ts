const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function weekday(day: string) {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** "Thu 22 Oct" */
export function shortDate(day: string) {
  return `${WEEKDAYS[weekday(day)]} ${+day.slice(8, 10)} ${MONTHS[+day.slice(5, 7) - 1]}`
}

/** "Thursday 22 October" */
export function longDate(day: string) {
  return `${WEEKDAYS_LONG[weekday(day)]} ${+day.slice(8, 10)} ${MONTHS_LONG[+day.slice(5, 7) - 1]}`
}

export function weekdayShort(day: string) {
  return WEEKDAYS[weekday(day)]
}

export const WEEKDAY_SHORT = WEEKDAYS
export const WEEKDAY_LONG = WEEKDAYS_LONG

/** "Wed 21 to Tue 27 Oct" */
export function rangeLabel(from: string, to: string) {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  const a = `${WEEKDAYS[weekday(from)]} ${+from.slice(8, 10)}${sameMonth ? '' : ` ${MONTHS[+from.slice(5, 7) - 1]}`}`
  return `${a} to ${shortDate(to)}`
}

/** 1.75 -> "1 h 45 min" */
export function hm(hours: number) {
  const m = Math.round(hours * 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h === 0) return `${mm} min`
  if (mm === 0) return `${h} h`
  return `${h} h ${mm} min`
}

/** Percent of the day as time per day: 50 -> "12 h" */
export function perDay(pct: number) {
  return hm((pct / 100) * 24)
}

/** 14.5 -> "14:30" */
export function clock(hours: number) {
  const m = Math.round(hours * 60)
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function f1(v: number) {
  return (Math.round(v * 10) / 10).toFixed(1)
}

export function pct(v: number, digits = 0) {
  return `${v.toFixed(digits)}%`
}

/** Rounded duration for sentences: 2.03 -> "2 hours", 1.6 -> "1 h 30 min". */
export function about(hours: number) {
  const q = Math.round(hours * 4) / 4
  if (q < 1) return `${Math.max(15, Math.round(q * 60))} min`
  if (Number.isInteger(q)) return q === 1 ? '1 hour' : `${q} hours`
  return hm(q)
}
