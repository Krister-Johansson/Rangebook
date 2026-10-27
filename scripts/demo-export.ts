// Writes a made-up Glooko-style export zip so the app can be tried without
// real data. The glucose curve comes from a small simulation of meals,
// insulin and a Control-IQ-like controller. It is not a physiological model;
// it only has to look like an export and contain patterns the rules can find.
//
//   pnpm demo:export [--days 90] [--end 2026-01-31] [--seed 7] [--out demo-export.zip]

import { writeFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])

const DAYS = Number(args.get('days') ?? 90)
const END = args.get('end') ?? new Date().toISOString().slice(0, 10)
const OUT = args.get('out') ?? 'demo-export.zip'
const SERIAL = '0000000'
const STEPS_PER_DAY = 288

// Seeded random numbers, so the same seed gives the same export.
let seed = Number(args.get('seed') ?? 7) >>> 0
function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const chance = (p: number) => rand() < p
const between = (a: number, b: number) => a + rand() * (b - a)
const gauss = (sd: number) => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand()) * sd
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d

// Time is counted in 5-minute steps from midnight of the first simulated day.
// One extra day runs first so insulin and carbs already on board settle.
const startMs = Date.UTC(+END.slice(0, 4), +END.slice(5, 7) - 1, +END.slice(8, 10)) - (DAYS - 1) * 86_400_000
const WARMUP = STEPS_PER_DAY
const LAST = WARMUP + (DAYS - 1) * STEPS_PER_DAY + 12 * 12 // export ends at 12:00 on the last day
const N = LAST + 1

const ts = (step: number) => new Date(startMs + (step - WARMUP) * 300_000).toISOString().slice(0, 16).replace('T', ' ')
const dayOf = (step: number) => Math.floor((step - WARMUP) / STEPS_PER_DAY)
const hourOf = (step: number) => ((step % STEPS_PER_DAY) * 5) / 60
const weekdayOf = (step: number) => new Date(startMs + (step - WARMUP) * 300_000).getUTCDay()
const isWeekend = (step: number) => [0, 6].includes(weekdayOf(step))

// Effect curves: share of the total effect per 5-minute step.
function curve(steps: number, peak: number) {
  const raw = Array.from({ length: steps }, (_, k) => (k + 1) * Math.exp(-(k + 1) / peak))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((v) => v / sum)
}
const INSULIN = curve(60, 15) // 5 hours, peak about 75 minutes
const CARBS = curve(36, 8) // 3 hours, peak about 40 minutes

// The simulated person. Programmed settings change once, halfway through,
// so the export has a profile switch to detect.
const ISF = 2.6 // true mmol/L drop per unit
const CSF = 0.22 // true mmol/L rise per gram
const SWITCH = WARMUP + Math.floor(DAYS / 2) * STEPS_PER_DAY + 113 // 09:25
const profile = (step: number) =>
  step < SWITCH
    ? { basal: 0.7, ratio: hourOf(step) < 10 ? 10 : 12, isf: 3.2 }
    : { basal: 0.8, ratio: hourOf(step) < 10 ? 8 : 9, isf: 3.0 }
const basalNeed = (step: number) => {
  const h = hourOf(step)
  if (h >= 4 && h < 8) return 1.05
  if (h >= 16 && h < 20) return 0.95
  return 0.85
}

const delta = new Float64Array(N + 80)
const g = new Float64Array(N)
const insulinOnBoard = new Float64Array(N + 80) // bolus insulin only, for the controller

function addInsulin(step: number, units: number, effective = 1) {
  INSULIN.forEach((share, k) => {
    delta[step + k + 1] -= units * ISF * share * effective
    if (k < 48) insulinOnBoard[step + k] += units * (1 - k / 48)
  })
}
function addCarbs(step: number, grams: number) {
  CARBS.forEach((share, k) => (delta[step + k + 1] += grams * CSF * share))
}

// Rows for each file, newest first at the end.
const cgmRows: string[] = []
const bgRows: string[] = []
const bolusRows: string[] = []
const basalRows: { step: number; type: 'Scheduled' | 'Suspend'; rate: number; steps: number }[] = []
const alarmRows: string[] = []
const basalU = new Float64Array(DAYS + 2)
const bolusU = new Float64Array(DAYS + 2)

const fmt = (v: number) => String(round(v, 3))
const out = (step: number) => step >= WARMUP

function bolus(step: number, units: number, opts: { bg?: number; carbs?: number; ratio?: number; effective?: number }) {
  units = round(units, 2)
  if (units < 0.05) return
  addInsulin(step, units, opts.effective)
  if (!out(step)) return
  bolusU[dayOf(step)] += units
  bolusRows.push(
    [
      ts(step),
      'Normal',
      (opts.bg ?? 0).toFixed(1),
      (opts.carbs ?? 0).toFixed(1),
      opts.ratio ? opts.ratio.toFixed(1) : '',
      fmt(units),
      '',
      '',
      SERIAL,
    ].join(','),
  )
}
function alarm(step: number, event: string) {
  if (out(step)) alarmRows.push(`${ts(step)},${event},${SERIAL}`)
}

// Plan the days: meals, cartridge changes, sensor gaps and one failed site.
interface Meal {
  step: number
  carbs: number
  bolus: 'none' | 'on time' | 'late'
}
const meals: Meal[] = []
const cartridge = new Map<number, number>() // step -> suspend length in steps
const sensorOff = new Uint8Array(N)
let badSiteUntil = -1
const badSiteStep = WARMUP + Math.floor(DAYS * 0.3) * STEPS_PER_DAY + 19 * 12

for (let d = -1; d < DAYS; d++) {
  const base = WARMUP + d * STEPS_PER_DAY
  const weekend = isWeekend(base)
  const later = base >= SWITCH
  const at = (h: number, jitterMin: number) => base + Math.round((h * 60 + gauss(jitterMin)) / 5)
  const grams = (a: number, b: number) => Math.round(between(a, b) / 5) * 5

  meals.push(
    weekend
      ? { step: at(9.5, 40), carbs: grams(40, 60), bolus: chance(0.8) ? 'on time' : 'none' }
      : { step: at(6.9, 12), carbs: grams(30, 50), bolus: chance(0.85) ? 'on time' : 'none' },
  )
  meals.push(
    weekend
      ? { step: at(13, 50), carbs: grams(45, 70), bolus: chance(0.7) ? 'on time' : 'none' }
      : { step: at(11.75, 12), carbs: grams(45, 70), bolus: chance(later ? 0.85 : 0.4) ? 'on time' : 'none' },
  )
  if (chance(0.75)) meals.push({ step: at(15.5, 25), carbs: grams(20, 35), bolus: chance(0.2) ? 'on time' : 'none' })
  meals.push({
    step: at(18.5, 30),
    carbs: grams(50, 80),
    bolus: chance(later ? 0.85 : 0.6) ? (chance(0.45) ? 'late' : 'on time') : 'none',
  })
  if (weekend && chance(0.7)) meals.push({ step: at(21.7, 30), carbs: grams(20, 40), bolus: 'none' })

  if ((d + 3) % 3 === 0) {
    const long = chance(0.12)
    cartridge.set(at(19.5, 40), long ? Math.round(between(120, 300) / 5) : Math.round(between(10, 25) / 5))
  }
}

// Sensor sessions of 10 days with a 2-hour warm-up, a 2-day gap when a sensor
// ran out, and short signal dropouts.
for (let s = WARMUP + 2 * STEPS_PER_DAY + 100; s < N; s += 10 * STEPS_PER_DAY) sensorOff.fill(1, s, s + 24)
const outage = WARMUP + Math.floor(DAYS * 0.62) * STEPS_PER_DAY + 90
sensorOff.fill(1, outage, outage + 2 * STEPS_PER_DAY)
for (let i = 0; i < DAYS * 0.6; i++) {
  const s = WARMUP + Math.floor(rand() * DAYS * STEPS_PER_DAY)
  sensorOff.fill(1, s, s + Math.round(between(3, 9)))
}

// Simulation loop.
const mealAt = new Map<number, Meal[]>()
for (const m of meals) if (m.step >= 0 && m.step < N) mealAt.set(m.step, [...(mealAt.get(m.step) ?? []), m])
const lateBolus = new Map<number, Meal>()

let suspendedUntil = -1
let lastAutoBolus = -100
let lastHighAlarm = -100
let lastLowAlarm = -100
let treatedUntil = -1
let noise = 0
let segment: (typeof basalRows)[number] | null = null

g[0] = 7
for (let i = 1; i < N; i++) {
  // Liver output rises glucose; delivered basal (scheduled below) brings it down.
  noise = 0.85 * noise + gauss(0.06)
  g[i] = Math.max(1.6, Math.min(27, g[i - 1] + delta[i] + (basalNeed(i) * ISF) / 12 - 0.004 * (g[i - 1] - 7) + noise))

  const cgmOn = !sensorOff[i]
  const reading = g[i] + gauss(0.2)
  if (cgmOn && out(i)) {
    const v = reading < 2.2 ? '0.1' : reading > 22.2 ? '111.1' : reading.toFixed(1)
    cgmRows.push(`${ts(i)},${v},${SERIAL}`)
  }
  const trend = (g[i] - g[Math.max(0, i - 3)]) / 3
  const pred = g[i] + 6 * trend
  const p = profile(i)

  if (i === badSiteStep) badSiteUntil = i + 10 * 12
  const effective = i < badSiteUntil ? 0.05 : 1

  // Lows get treated with fast carbs and no bolus.
  if (g[i] < 3.6 && i > treatedUntil && chance(0.85)) {
    addCarbs(i, pick([10, 15, 15, 20]))
    treatedUntil = i + 4
  }

  for (const m of mealAt.get(i) ?? []) {
    addCarbs(i, m.carbs)
    if (m.bolus === 'late') lateBolus.set(i + Math.round(between(3, 6)), m)
    if (m.bolus !== 'on time') continue
    const withBg = cgmOn && chance(0.75)
    const correction = withBg && reading > 8 ? Math.max(0, (reading - 6.1) / p.isf - insulinOnBoard[i]) : 0
    bolus(i, m.carbs / p.ratio + correction, {
      carbs: m.carbs,
      bg: withBg ? round(reading, 1) : 0,
      ratio: withBg ? undefined : p.ratio,
      effective,
    })
    if (withBg && chance(0.2) && out(i)) bgRows.push(`${ts(i)},${reading.toFixed(1)},M,${SERIAL}`)
  }
  const late = lateBolus.get(i)
  if (late) bolus(i, late.carbs / p.ratio, { carbs: late.carbs, bg: cgmOn ? round(reading, 1) : 0, effective })

  // A manual correction now and then when glucose stays high in the evening.
  if (cgmOn && reading > 14 && hourOf(i) >= 16 && hourOf(i) < 23 && chance(0.006)) {
    bolus(i, (reading - 6.1) / p.isf - insulinOnBoard[i], { bg: round(reading, 1), ratio: p.ratio, effective })
    if (out(i)) bgRows.push(`${ts(i)},${reading.toFixed(1)},M,${SERIAL}`)
  }
  if (out(i) && chance(1 / (7 * STEPS_PER_DAY))) bgRows.push(`${ts(i)},${(g[i] + gauss(0.4)).toFixed(1)},M,${SERIAL}`)

  // Cartridge changes suspend the pump; long ones end with a resume alarm.
  const stop = cartridge.get(i)
  if (stop) {
    if (chance(0.3)) alarm(i - 30, 'Empty Cartridge Alarm (8A)')
    alarm(i + 2, 'Cartridge Loaded')
    if (stop > 24) alarm(i + 24, 'Resume Pump Alarm (18A)')
    suspendedUntil = i + stop
  }
  if (chance(1 / (5 * STEPS_PER_DAY))) alarm(i, pick(['Low Power Alert (2T)', 'Low Power Alert (2T)', 'Low Power Alert (3T)']))
  if (sensorOff[i] && !sensorOff[i - 1] && sensorOff[i + 30]) alarm(i + 4, 'tandem_cgm_unavailable')

  // Basal: the pump's own controller when the sensor works, profile otherwise.
  let rate = p.basal
  let type: 'Scheduled' | 'Suspend' = 'Scheduled'
  if (i < suspendedUntil) {
    rate = 0
    type = 'Suspend'
  } else if (cgmOn) {
    if (pred < 3.9) rate = 0
    else if (pred < 6.25) rate = p.basal * ((pred - 3.9) / 2.35)
    else if (pred > 8.9) rate = p.basal * Math.min(3, 1 + (pred - 8.9) * 0.3)
    rate = round(rate, 3)

    const sleeping = hourOf(i) < 6
    if (!sleeping && pred > 10 && i - lastAutoBolus >= 12) {
      const units = ((pred - 6.1) / p.isf) * 0.6 - 0.5 * insulinOnBoard[i]
      if (units >= 0.05) {
        bolus(i, Math.min(units, 6), { bg: round(pred, 1), effective })
        lastAutoBolus = i
      }
    }
    if (pred > 13.9 && i - lastHighAlarm > 24) {
      alarm(i, 'tandem_controliq_high')
      lastHighAlarm = i
    }
    if (pred < 3.9 && i - lastLowAlarm > 12) {
      alarm(i, 'tandem_controliq_low')
      lastLowAlarm = i
    }
  }
  addInsulin(i, rate / 12, effective)
  if (out(i)) basalU[dayOf(i)] += rate / 12

  // Merge equal 5-minute rates into one segment, like the pump does.
  if (out(i)) {
    if (segment && segment.rate === rate && segment.type === type && hourOf(i) !== 0) segment.steps++
    else {
      segment = { step: i, type, rate, steps: 1 }
      basalRows.push(segment)
    }
  }
}

// Files.
const lastTs = ts(LAST)
const header = `﻿Name:Demo Patient,Date Range:${ts(WARMUP).slice(0, 10)} - ${lastTs.slice(0, 10)}`
const file = (columns: string, rows: string[]) => strToU8([header, columns, ...rows.slice().reverse()].join('\n') + '\n')

const daily: string[] = []
for (let d = 0; d < DAYS; d++) {
  const stamp = d === DAYS - 1 ? lastTs : `${ts(WARMUP + d * STEPS_PER_DAY).slice(0, 10)} 23:58`
  daily.push([stamp, fmt(bolusU[d]), fmt(bolusU[d] + basalU[d]), fmt(basalU[d]), SERIAL].join(','))
}
const basal = basalRows.map((s) => [ts(s.step), s.type, s.steps * 5, '', s.rate.toFixed(3).replace(/\.?0+$/, '') || '0', '', SERIAL].join(','))

// The CGM file holds at most 20,000 rows; older readings go to file 2.
const CGM_CAP = 20_000
const cgmColumns = 'Timestamp,CGM Glucose Value (mmol/l),Serial Number'
const files: Record<string, Uint8Array> = {
  'cgm_data_1.csv': file(cgmColumns, cgmRows.slice(-CGM_CAP)),
  'bg_data_1.csv': file('Timestamp,Glucose Value (mmol/l),Manual Reading,Serial Number', bgRows),
  'alarms_data_1.csv': file('Timestamp,Alarm/Event,Serial Number', alarmRows),
  'cgm_carbs_data_1.csv': file('Timestamp,Carbs (g)', []),
  'Insulin data/bolus_data_1.csv': file(
    'Timestamp,Insulin Type,Blood Glucose Input (mmol/l),Carbs Input (g),Carbs Ratio,Insulin Delivered (U),Initial Delivery (U),Extended Delivery (U),Serial Number',
    bolusRows,
  ),
  'Insulin data/basal_data_1.csv': file(
    'Timestamp,Insulin Type,Duration (minutes),Percentage (%),Rate,Insulin Delivered (U),Serial Number',
    basal,
  ),
  'Insulin data/insulin_data_1.csv': file('Timestamp,Total Bolus (U),Total Insulin (U),Total Basal (U),Serial Number', daily),
  'Manual data/exercise_data_1.csv': file('Timestamp,Name,Intensity,Duration (minutes),Calories Burned', []),
  'Manual data/food_data_1.csv': file('Timestamp,Name,Carbs (g),Fat,Protein,Calories,Serving Quantity,Number of Servings', []),
  'Manual data/manual_insulin_data_1.csv': file('Timestamp,Name,Value,Insulin Type', []),
  'Manual data/medication_data_1.csv': file('Timestamp,Name,Value,Medication Type', []),
  'Manual data/notes_data_1.csv': file('Timestamp,Value', []),
}
if (cgmRows.length > CGM_CAP) files['cgm_data_2.csv'] = file(cgmColumns, cgmRows.slice(0, -CGM_CAP))

writeFileSync(OUT, zipSync(files))
console.log(
  `Wrote ${OUT}: ${DAYS} days to ${lastTs}, ${cgmRows.length} CGM readings, ${bolusRows.length} boluses, ${basalRows.length} basal segments, ${alarmRows.length} alarms.`,
)
