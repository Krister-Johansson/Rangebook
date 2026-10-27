import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { prefsQuery } from '#/lib/queries'
import { setPref } from '#/server/preferences'
import type { Prefs } from '#/server/preferences'

export type ShareKey = keyof Prefs['sharing']

export const SHARE_ITEMS: { id: ShareKey; label: string; description: string }[] = [
  { id: 'home', label: 'Home summary', description: 'Time in ranges, average and your goal.' },
  { id: 'typical', label: 'Typical day', description: 'The 90-day typical day chart.' },
  { id: 'map', label: 'Week map', description: 'Day by hour squares.' },
  { id: 'patterns', label: 'Patterns and saved questions', description: 'Only questions you saved.' },
  { id: 'days', label: 'Single days', description: 'Readings, carbs and boluses for each day.' },
  {
    id: 'progress',
    label: 'Progress and badges',
    description: 'Level, badges, challenges and personal bests.',
  },
]

/** Saves one or more preferences, showing the change right away. */
export function useSetPrefs() {
  const queryClient = useQueryClient()
  const key = prefsQuery.queryKey
  return useMutation({
    mutationFn: (patch: Partial<Prefs>) => setPref({ data: patch }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      if (previous) queryClient.setQueryData(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error('That change was not saved. Try again.')
    },
    onSettled: (_data, _err, patch) => {
      queryClient.invalidateQueries({ queryKey: key })
      // Leaving out not-normal days changes patterns and comparisons.
      if (patch.excludeNotNormal !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['glucose'] })
        queryClient.invalidateQueries({ queryKey: ['lifelog'] })
      }
    },
  })
}
