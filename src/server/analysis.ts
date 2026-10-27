import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { addDays } from '#/lib/glucose/core'
import {
  dayDetail,
  daySummaries,
  homeData,
  hourlyProfile,
  systemCheck,
  weekHeatmap,
} from '#/lib/glucose/analysis'
import { findPatterns } from '#/lib/glucose/patterns'
import { inDays } from '#/lib/glucose/core'
import { loadDataset } from './dataset'
import { activePersonId } from './active-person'

const PROFILE_DAYS = 90

async function activeDataset() {
  const personId = await activePersonId()
  return personId === null ? null : loadDataset(personId)
}

function window(lastDay: string, firstDay: string, days: number) {
  const from = addDays(lastDay, -(days - 1))
  return { from: from < firstDay ? firstDay : from, to: lastDay }
}

/** Range of the stored data, or null when nothing is imported yet. */
export const getDataRange = createServerFn({ method: 'GET' }).handler(async () => {
  const ds = await activeDataset()
  if (!ds) return null
  return { firstDay: ds.firstDay, lastDay: ds.lastDay, lastTs: ds.lastTs }
})

export const getHome = createServerFn({ method: 'GET' }).handler(async () => {
  const ds = await activeDataset()
  if (!ds) return null
  const { from, to } = window(ds.lastDay, ds.firstDay, 7)
  return { ...homeData(ds), system: systemCheck(ds, from, to), lastTs: ds.lastTs }
})

export const getProfile = createServerFn({ method: 'GET' })
  .validator(z.object({ dayType: z.enum(['all', 'school', 'weekend']).default('all') }))
  .handler(async ({ data }) => {
    const ds = await activeDataset()
    if (!ds) return null
    const { from, to } = window(ds.lastDay, ds.firstDay, PROFILE_DAYS)
    return {
      from,
      to,
      dayType: data.dayType,
      hours: hourlyProfile(inDays(ds.readings, from, to), data.dayType),
    }
  })

export const getHeatmap = createServerFn({ method: 'GET' }).handler(async () => {
  const ds = await activeDataset()
  if (!ds) return null
  const { from, to } = window(ds.lastDay, ds.firstDay, PROFILE_DAYS)
  return { from, to, cells: weekHeatmap(inDays(ds.readings, from, to)) }
})

export const getPatterns = createServerFn({ method: 'GET' }).handler(async () => {
  const ds = await activeDataset()
  if (!ds) return null
  return findPatterns(ds, PROFILE_DAYS)
})

export const getDay = createServerFn({ method: 'GET' })
  .validator(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
  .handler(async ({ data }) => {
    const ds = await activeDataset()
    if (!ds) return null
    const day = data.day && data.day >= ds.firstDay && data.day <= ds.lastDay ? data.day : ds.lastDay
    return dayDetail(ds, day)
  })

/** Per-day summaries, newest first, for the day picker. */
export const getDays = createServerFn({ method: 'GET' })
  .validator(z.object({ days: z.number().int().min(1).max(120).default(14) }))
  .handler(async ({ data }) => {
    const ds = await activeDataset()
    if (!ds) return []
    const { from, to } = window(ds.lastDay, ds.firstDay, data.days)
    return daySummaries(ds, from, to).reverse()
  })

export const getSystemCheck = createServerFn({ method: 'GET' })
  .validator(z.object({ days: z.number().int().min(1).max(120).default(14) }))
  .handler(async ({ data }) => {
    const ds = await activeDataset()
    if (!ds) return null
    const { from, to } = window(ds.lastDay, ds.firstDay, data.days)
    return { from, to, items: systemCheck(ds, from, to) }
  })
