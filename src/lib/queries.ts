import { queryOptions } from '@tanstack/react-query'

import type { DayType } from '#/lib/glucose/analysis'
import {
  getDataRange,
  getDay,
  getDays,
  getHeatmap,
  getHome,
  getPatterns,
  getProfile,
  getSystemCheck,
} from '#/server/analysis'
import { getDataOverview, listImports } from '#/server/imports'
import { getPrefs } from '#/server/preferences'

// Data only changes on import, so analysis results stay fresh until the import
// mutation invalidates the 'glucose' key.
const staleTime = Infinity

export const importsQuery = queryOptions({
  queryKey: ['imports'],
  queryFn: () => listImports(),
})

export const overviewQuery = queryOptions({
  queryKey: ['overview'],
  queryFn: () => getDataOverview(),
})

export const dataRangeQuery = queryOptions({
  queryKey: ['glucose', 'range'],
  queryFn: () => getDataRange(),
  staleTime,
})

export const homeQuery = queryOptions({
  queryKey: ['glucose', 'home'],
  queryFn: () => getHome(),
  staleTime,
})

export const profileQuery = (dayType: DayType) =>
  queryOptions({
    queryKey: ['glucose', 'profile', dayType],
    queryFn: () => getProfile({ data: { dayType } }),
    staleTime,
  })

export const heatmapQuery = queryOptions({
  queryKey: ['glucose', 'heatmap'],
  queryFn: () => getHeatmap(),
  staleTime,
})

export const patternsQuery = queryOptions({
  queryKey: ['glucose', 'patterns'],
  queryFn: () => getPatterns(),
  staleTime,
})

export const dayQuery = (day?: string) =>
  queryOptions({
    queryKey: ['glucose', 'day', day ?? 'latest'],
    queryFn: () => getDay({ data: { day } }),
    staleTime,
  })

export const daysQuery = (days = 14) =>
  queryOptions({
    queryKey: ['glucose', 'days', days],
    queryFn: () => getDays({ data: { days } }),
    staleTime,
  })

export const systemCheckQuery = (days = 14) =>
  queryOptions({
    queryKey: ['glucose', 'system', days],
    queryFn: () => getSystemCheck({ data: { days } }),
    staleTime,
  })

export const prefsQuery = queryOptions({
  queryKey: ['prefs'],
  queryFn: () => getPrefs(),
})
