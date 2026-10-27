// Game layer: XP, levels, badges, weekly challenges and personal bests.
//
// Rules from docs/research/teen-ux.md: rewards go to things the teen controls
// (sensor wear, carbs entered, challenges, clinic questions), never to glucose
// values alone. XP is never taken away, levels never drop and there are no
// streaks that reset. Personal bests are the one place outcomes appear, and
// only as celebrations against her own history. Everything is recomputed from
// imported data, so importing the same days again never counts twice.

import { addDays, weekdayOf } from './core'
import { hm, rangeLabel, shortDate } from './format'

export interface DayActivity {
  day: string
  readings: number
  inRange: number
  carbBoluses: number
  lunchCarbs: boolean
}

export interface Stretch {
  minutes: number
  start: string
  end: string
}

export interface QuestionEvent {
  patternId: string
  firstSaved: string // YYYY-MM-DD, local
}

export interface ChallengePick {
  weekStart: string
  challengeId: ChallengeId
}

export const SENSOR_DAY_READINGS = Math.ceil(288 * 0.7)
const isSensorDay = (d: DayActivity) => d.readings >= SENSOR_DAY_READINGS

export const XP_RULES = [
  { id: 'sensor', label: 'Sensor day', xp: 10, note: 'CGM worn 70% or more of the day' },
  { id: 'carbs', label: 'Bolus with carbs entered', xp: 5, note: 'Up to 4 a day' },
  { id: 'challenge', label: 'Weekly challenge done', xp: 50, note: 'One challenge a week' },
  { id: 'badge', label: 'Badge earned', xp: 25, note: 'Each tier counts' },
  { id: 'question', label: 'Question saved for clinic', xp: 5, note: 'Once per question' },
] as const

const LEVELS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]

export function levelStart(level: number) {
  return level <= LEVELS.length ? LEVELS[level - 1] : LEVELS[LEVELS.length - 1] + (level - LEVELS.length) * 550
}

export interface LevelInfo {
  level: number
  from: number
  to: number
  into: number
  need: number
  left: number
}

export function levelFor(xp: number): LevelInfo {
  let level = 1
  while (xp >= levelStart(level + 1)) level++
  const from = levelStart(level)
  const to = levelStart(level + 1)
  return { level, from, to, into: xp - from, need: to - from, left: to - xp }
}

export const STAGES = [
  { n: 1, levels: 'Levels 1 and 2', name: 'Seed', growsAt: 3 },
  { n: 2, levels: 'Levels 3 and 4', name: 'Sprout', growsAt: 5 },
  { n: 3, levels: 'Levels 5 and 6', name: 'Sapling', growsAt: 7 },
  { n: 4, levels: 'Levels 7 to 9', name: 'Bud', growsAt: 10 },
  { n: 5, levels: 'Level 10 and up', name: 'Bloom', growsAt: null },
] as const

export function stageFor(level: number) {
  return level >= 10 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1
}

export const CHALLENGES = [
  { id: 'meals', name: 'Meal boluses', text: 'Enter carbs for 3 meals on 5 days', target: 5, unit: 'days' },
  { id: 'wear', name: 'Full wear', text: 'Wear the sensor all 7 days', target: 7, unit: 'days' },
  { id: 'lunch', name: 'School lunch', text: 'Enter carbs at lunch on every school day', target: 5, unit: 'school days' },
  { id: 'clinic', name: 'Clinic prep', text: 'Save 2 questions for your care team', target: 2, unit: 'questions' },
] as const

export type ChallengeId = (typeof CHALLENGES)[number]['id']
export const CHALLENGE_IDS = CHALLENGES.map((c) => c.id) as [ChallengeId, ...ChallengeId[]]

export const BADGES = [
  { id: 'fullweek', name: 'Full week', what: 'Weeks with 7 sensor days', unit: 'weeks', tiers: [1, 4, 10] },
  { id: 'meal', name: 'Meal logger', what: 'Boluses with carbs entered', unit: 'boluses', tiers: [50, 150, 300] },
  { id: 'lunch', name: 'Lunch pro', what: 'School lunches with carbs entered', unit: 'lunches', tiers: [10, 30, 60] },
  { id: 'challenger', name: 'Challenger', what: 'Weekly challenges done', unit: 'challenges', tiers: [1, 5, 10] },
  { id: 'clinic', name: 'Clinic ready', what: 'Questions saved for clinic', unit: 'questions', tiers: [1, 3, 6] },
  { id: 'bests', name: 'Personal best', what: 'Personal bests set', unit: 'bests', tiers: [1, 3, 6] },
] as const

export type BadgeId = (typeof BADGES)[number]['id']
export const TIERS = ['bronze', 'silver', 'gold'] as const
export type Tier = (typeof TIERS)[number]

/** Monday of the week that holds `day`. */
export function weekStartOf(day: string) {
  return addDays(day, -weekdayOf(day))
}

const isSchoolDay = (day: string) => weekdayOf(day) <= 4

export interface WeekXp {
  weekStart: string
  label: string
  sensorDays: number
  sensor: number
  carbs: number
  challenge: number
  badge: number
  question: number
  total: number
  current: boolean
}

export interface BadgeState {
  id: BadgeId
  name: string
  what: string
  unit: string
  tiers: readonly number[]
  count: number
  earned: { tier: Tier; weekStart: string; fresh: boolean }[]
  next: { tier: Tier; target: number; left: number } | null
}

export interface ChallengeProgress {
  id: ChallengeId
  done: number
  target: number
  complete: boolean
  // One mark per day of the week (Mon to Sun, or Mon to Fri for lunch):
  // true counted, false not counted, null no data yet.
  marks: (boolean | null)[]
}

export interface Best {
  id: 'day' | 'stretch' | 'week' | 'carbs' | 'wear'
  label: string
  value: string
  sub: string
  date: string
  day: string | null
  fresh: boolean
}

export interface GameState {
  xp: number
  level: LevelInfo
  stage: number
  weeks: WeekXp[]
  badges: BadgeState[]
  thisWeek: {
    weekStart: string
    label: string
    pick: ChallengeId | null
    canChange: boolean
    changeUntil: string
    progress: ChallengeProgress[]
  }
  history: { weekStart: string; label: string; id: ChallengeId; got: number; target: number; done: boolean }[]
  bests: Best[]
  mood: 'happy' | 'curious' | 'celebrating' | 'sleepy'
  line: string
  daysSinceData: number | null
}

export interface GameInput {
  days: DayActivity[]
  longestStretch: Stretch | null
  questions: QuestionEvent[]
  picks: ChallengePick[]
  today: string
  // First day that is new in the latest import: bests and badges from here
  // on are marked "new". Null means only one import, so the last week counts.
  freshFrom: string | null
}

function progressFor(id: ChallengeId, weekStart: string, byDay: Map<string, DayActivity>, questions: QuestionEvent[], lastDay: string | null): ChallengeProgress {
  const challenge = CHALLENGES.find((c) => c.id === id)!
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const known = (day: string) => lastDay !== null && day <= lastDay
  let marks: (boolean | null)[] = []
  let done = 0
  if (id === 'clinic') {
    done = questions.filter((q) => q.firstSaved >= weekStart && q.firstSaved <= weekDays[6]).length
  } else {
    const days = id === 'lunch' ? weekDays.filter(isSchoolDay) : weekDays
    marks = days.map((day) => {
      if (!known(day)) return null
      const d = byDay.get(day)
      const ok = !!d && (id === 'meals' ? d.carbBoluses >= 3 : id === 'wear' ? isSensorDay(d) : d.lunchCarbs)
      // The last imported day is usually cut off, so it is not counted as missed yet.
      if (!ok && day === lastDay) return null
      return ok
    })
    done = marks.filter((m) => m === true).length
  }
  return { id, done, target: challenge.target, complete: done >= challenge.target, marks }
}

export function computeGame(input: GameInput): GameState {
  const { days, questions, picks, today } = input
  const byDay = new Map(days.map((d) => [d.day, d]))
  const lastDay = [...days].reverse().find((d) => d.readings > 0)?.day ?? null
  const firstDay = days[0]?.day ?? today
  const currentWeek = weekStartOf(today)
  const freshFrom = input.freshFrom ?? (lastDay ? addDays(lastDay, -6) : today)

  // Weeks from the first data week to this week.
  const weekStarts: string[] = []
  for (let w = weekStartOf(firstDay); w <= currentWeek; w = addDays(w, 7)) weekStarts.push(w)

  const pickByWeek = new Map(picks.map((p) => [p.weekStart, p.challengeId]))
  const weeks: WeekXp[] = weekStarts.map((w) => ({
    weekStart: w,
    label: shortDate(w).replace(/^\w+ /, ''),
    sensorDays: 0,
    sensor: 0,
    carbs: 0,
    challenge: 0,
    badge: 0,
    question: 0,
    total: 0,
    current: w === currentWeek,
  }))
  const weekIndex = new Map(weekStarts.map((w, i) => [w, i]))

  for (const d of days) {
    const wk = weeks[weekIndex.get(weekStartOf(d.day))!]
    if (!wk) continue
    if (isSensorDay(d)) {
      wk.sensorDays++
      wk.sensor += 10
    }
    wk.carbs += Math.min(4, d.carbBoluses) * 5
  }
  for (const q of questions) {
    const wk = weeks[weekIndex.get(weekStartOf(q.firstSaved)) ?? -1]
    if (wk) wk.question += 5
  }

  // Challenges and their history.
  const history: GameState['history'] = []
  const challengesDoneByWeek = new Map<string, number>()
  for (const w of weekStarts) {
    const id = pickByWeek.get(w)
    if (!id) continue
    const p = progressFor(id, w, byDay, questions, lastDay)
    if (p.complete) {
      weeks[weekIndex.get(w)!].challenge += 50
      challengesDoneByWeek.set(w, 1)
    }
    if (w < currentWeek) {
      history.push({ weekStart: w, label: `Week of ${shortDate(w).replace(/^\w+ /, '')}`, id, got: p.done, target: p.target, done: p.complete })
    }
  }
  history.reverse()

  // Personal bests, walked in time so each new best is an event.
  const bestEvents: string[] = []
  const settle = addDays(firstDay, 27) // the first four weeks only set the bar
  let bestDay: DayActivity | null = null
  let bestCarbs: DayActivity | null = null
  for (const d of days) {
    if (isSensorDay(d) && (!bestDay || d.inRange / d.readings > bestDay.inRange / bestDay.readings)) {
      if (bestDay && d.day > settle) bestEvents.push(`${d.day}|day`)
      bestDay = d
    }
    if (d.carbBoluses > 0 && (!bestCarbs || d.carbBoluses > bestCarbs.carbBoluses)) {
      if (bestCarbs && d.day > settle) bestEvents.push(`${d.day}|carbs`)
      bestCarbs = d
    }
  }
  let bestWeek: { weekStart: string; pct: number; to: string } | null = null
  let bestWear: { weekStart: string; days: number; count: number } | null = null
  for (const wk of weeks) {
    const inWeek = Array.from({ length: 7 }, (_, i) => byDay.get(addDays(wk.weekStart, i))).filter(
      (d): d is DayActivity => !!d && isSensorDay(d),
    )
    if (inWeek.length >= 5) {
      const pct = (inWeek.reduce((n, d) => n + d.inRange, 0) / inWeek.reduce((n, d) => n + d.readings, 0)) * 100
      if (!bestWeek || pct > bestWeek.pct) {
        if (bestWeek && wk.weekStart > settle) bestEvents.push(`${inWeek[inWeek.length - 1].day}|week`)
        bestWeek = { weekStart: wk.weekStart, pct, to: inWeek[inWeek.length - 1].day }
      }
    }
    if (wk.sensorDays > 0) {
      if (!bestWear || wk.sensorDays > bestWear.days) bestWear = { weekStart: wk.weekStart, days: wk.sensorDays, count: 1 }
      else if (wk.sensorDays === bestWear.days) bestWear = { weekStart: wk.weekStart, days: wk.sensorDays, count: bestWear.count + 1 }
    }
  }

  // Badges: walk weeks, add counts, and award each tier in the week it is reached.
  const counters: Record<BadgeId, number> = { fullweek: 0, meal: 0, lunch: 0, challenger: 0, clinic: 0, bests: 0 }
  const earned: Record<BadgeId, BadgeState['earned']> = { fullweek: [], meal: [], lunch: [], challenger: [], clinic: [], bests: [] }
  for (const wk of weeks) {
    const end = addDays(wk.weekStart, 6)
    const inWeek = days.filter((d) => d.day >= wk.weekStart && d.day <= end)
    if (wk.sensorDays === 7) counters.fullweek++
    counters.meal += inWeek.reduce((n, d) => n + d.carbBoluses, 0)
    counters.lunch += inWeek.filter((d) => isSchoolDay(d.day) && d.lunchCarbs).length
    counters.challenger += challengesDoneByWeek.get(wk.weekStart) ?? 0
    counters.clinic += questions.filter((q) => weekStartOf(q.firstSaved) === wk.weekStart).length
    // At most one best of each kind per week counts toward the badge.
    counters.bests += new Set(bestEvents.filter((e) => weekStartOf(e.split('|')[0]) === wk.weekStart).map((e) => e.split('|')[1])).size
    for (const b of BADGES) {
      while (earned[b.id].length < 3 && counters[b.id] >= b.tiers[earned[b.id].length]) {
        earned[b.id].push({ tier: TIERS[earned[b.id].length], weekStart: wk.weekStart, fresh: end >= freshFrom })
        wk.badge += 25
      }
    }
  }
  const badges: BadgeState[] = BADGES.map((b) => {
    const got = earned[b.id].length
    return {
      ...b,
      count: counters[b.id],
      earned: earned[b.id],
      next: got < 3 ? { tier: TIERS[got], target: b.tiers[got], left: b.tiers[got] - counters[b.id] } : null,
    }
  })

  for (const wk of weeks) wk.total = wk.sensor + wk.carbs + wk.challenge + wk.badge + wk.question
  const xp = weeks.reduce((n, w) => n + w.total, 0)
  const level = levelFor(xp)

  const bests: Best[] = []
  if (bestDay) {
    const pct = (bestDay.inRange / bestDay.readings) * 100
    bests.push({
      id: 'day',
      label: 'Most time in range in a day',
      value: `${pct.toFixed(1)}%`,
      sub: `about ${hm((pct / 100) * 24)}`,
      date: shortDate(bestDay.day),
      day: bestDay.day,
      fresh: bestDay.day >= freshFrom,
    })
  }
  if (input.longestStretch) {
    const s = input.longestStretch
    bests.push({
      id: 'stretch',
      label: 'Longest stretch in range',
      value: hm(s.minutes / 60),
      sub: 'in one go',
      date: `Ended ${shortDate(s.end.slice(0, 10))}, ${s.end.slice(11, 16)}`,
      day: s.end.slice(0, 10),
      fresh: s.end.slice(0, 10) >= freshFrom,
    })
  }
  if (bestWeek) {
    bests.push({
      id: 'week',
      label: 'Most time in range in a week',
      value: `${Math.round(bestWeek.pct)}%`,
      sub: `about ${hm((bestWeek.pct / 100) * 24)} a day`,
      date: rangeLabel(bestWeek.weekStart, addDays(bestWeek.weekStart, 6)),
      day: null,
      fresh: bestWeek.to >= freshFrom,
    })
  }
  if (bestCarbs) {
    bests.push({
      id: 'carbs',
      label: 'Most boluses with carbs in a day',
      value: String(bestCarbs.carbBoluses),
      sub: 'boluses with carbs',
      date: shortDate(bestCarbs.day),
      day: bestCarbs.day,
      fresh: bestCarbs.day >= freshFrom,
    })
  }
  if (bestWear) {
    bests.push({
      id: 'wear',
      label: 'Most sensor days in a week',
      value: `${bestWear.days} of 7`,
      sub: `reached in ${bestWear.count} week${bestWear.count === 1 ? '' : 's'}`,
      date: `Latest: week of ${shortDate(bestWear.weekStart).replace(/^\w+ /, '')}`,
      day: null,
      fresh: addDays(bestWear.weekStart, 6) >= freshFrom,
    })
  }

  // This week's challenge. It can be changed until the end of Wednesday.
  const pick = pickByWeek.get(currentWeek) ?? null
  const todayIndex = weekdayOf(today)
  const progress = CHALLENGES.map((c) => progressFor(c.id, currentWeek, byDay, questions, lastDay))

  const daysSinceData = lastDay ? Math.round((Date.parse(today) - Date.parse(lastDay)) / 86_400_000) : null
  const freshBadge = badges.flatMap((b) => b.earned.filter((e) => e.fresh).map((e) => ({ b, e }))).at(-1)
  const freshChallenge = pick && progress.find((p) => p.id === pick)?.complete
  let mood: GameState['mood'] = 'happy'
  let line = level.left <= 60 ? `${level.left} XP to level ${level.level + 1}. Your next import could do it.` : `${level.left} XP to level ${level.level + 1}.`
  if (daysSinceData !== null && daysSinceData >= 8) {
    mood = 'sleepy'
    line = `No new data for ${daysSinceData} days. Import to wake me up.`
  } else if (freshChallenge) {
    mood = 'celebrating'
    line = `Challenge done: ${CHALLENGES.find((c) => c.id === pick)!.name}!`
  } else if (freshBadge) {
    mood = 'celebrating'
    line = `${freshBadge.b.name} ${freshBadge.e.tier}! ${freshBadge.b.tiers[TIERS.indexOf(freshBadge.e.tier)]} ${freshBadge.b.unit}.`
  } else if (!pick && todayIndex <= 2) {
    mood = 'curious'
    line = "Want to pick this week's challenge? You can change it until Wednesday."
  }

  return {
    xp,
    level,
    stage: stageFor(level.level),
    weeks,
    badges,
    thisWeek: {
      weekStart: currentWeek,
      label: rangeLabel(currentWeek, addDays(currentWeek, 6)),
      pick,
      canChange: todayIndex <= 2,
      changeUntil: shortDate(addDays(currentWeek, 2)),
      progress,
    },
    history,
    bests,
    mood,
    line,
    daysSinceData,
  }
}
