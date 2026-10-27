import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { daysBetween } from '#/lib/glucose/core'
import { WEEKDAY_SHORT, shortDate } from '#/lib/glucose/format'
import { TAG_KINDS } from '#/lib/glucose/lifelog'
import type { LogEntry } from '#/lib/glucose/lifelog'
import { cn } from '#/lib/utils'
import { addLifeLogEntry, deleteLifeLogEntry } from '#/server/life-log'

/** 1050 -> "17:30" */
export function minClock(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** "17:30" -> 1050 */
export function clockMin(value: string) {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Today in local time as YYYY-MM-DD. */
export function todayLocal() {
  return new Date().toLocaleDateString('sv-SE')
}

export function tagLabel(tag: LogEntry['tag']) {
  return TAG_KINDS.find((t) => t.id === tag)?.label ?? 'Other'
}

/** [0, 3] -> "Mon and Thu", [0, 2, 4] -> "Mon, Wed and Fri" */
export function weekdaysText(days: number[] | null) {
  const names = [...(days ?? [])].sort().map((d) => WEEKDAY_SHORT[d])
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export function dateRangeText(start: string, end: string | null) {
  return !end || end === start ? shortDate(start) : `${shortDate(start)} to ${shortDate(end)}`
}

export function dayCount(start: string, end: string | null) {
  const n = end ? daysBetween(start, end) + 1 : 1
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

export function activitySchedule(a: LogEntry) {
  const time = a.startMin !== null && a.endMin !== null ? `, ${minClock(a.startMin)} to ${minClock(a.endMin)}` : ''
  return `${weekdaysText(a.weekdays)}${time}`
}

export function ByChip({ author }: { author: LogEntry['author'] }) {
  const parent = author === 'parent'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        parent ? 'border-parent/40 text-parent' : 'text-muted-foreground',
      )}
    >
      <UserRound aria-hidden="true" className="size-3" />
      <span className="sr-only">Added by </span>
      {parent ? 'Parent' : 'You'}
    </span>
  )
}

/** Add and delete life log entries; both refresh the log and everything that uses it. */
export function useLifeLogMutations() {
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lifelog'] }),
      queryClient.invalidateQueries({ queryKey: ['glucose'] }),
    ])
  const add = useMutation({
    mutationFn: (data: Parameters<typeof addLifeLogEntry>[0]['data']) => addLifeLogEntry({ data }),
    onSuccess: refresh,
    onError: (err) => toast.error(err.message || 'That was not saved. Try again.'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteLifeLogEntry({ data: { id } }),
    onSuccess: refresh,
    onError: () => toast.error('That was not deleted. Try again.'),
  })
  return { add, remove }
}

/** Trash button that asks before it deletes. */
export function DeleteEntry({
  id,
  what,
  onDeleted,
  withLabel = false,
}: {
  id: number
  what: string
  onDeleted?: () => void
  withLabel?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { remove } = useLifeLogMutations()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={withLabel ? 'sm' : 'icon'}
          className={withLabel ? undefined : 'size-9 shrink-0'}
          aria-label={withLabel ? undefined : `Delete ${what}`}
        >
          <Trash2 aria-hidden="true" />
          {withLabel ? 'Delete' : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-3">
        <p className="text-sm">
          Delete {what}? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Keep
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(id, {
                onSuccess: () => {
                  setOpen(false)
                  toast.success('Deleted')
                  onDeleted?.()
                },
              })
            }
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
