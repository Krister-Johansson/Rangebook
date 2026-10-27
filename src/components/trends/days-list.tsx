import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Dumbbell, StickyNote, Tag } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { DaySummary } from '#/lib/glucose/analysis'
import type { LogEntry } from '#/lib/glucose/lifelog'
import { longDate, weekdayShort } from '#/lib/glucose/format'
import { daysQuery, lifeLogQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

import { activitiesOn, notesOn, tagLabel, tagsOn } from './log-bands'

export const DAYS_SHOWN = 28
const MAX_DAYS = 112

export function DaysList() {
  const [count, setCount] = useState(DAYS_SHOWN)
  const first = useSuspenseQuery(daysQuery(DAYS_SHOWN))
  const more = useQuery({ ...daysQuery(count), enabled: count > DAYS_SHOWN, placeholderData: keepPreviousData })
  const days = (count > DAYS_SHOWN ? more.data : null) ?? first.data
  const { data: log } = useSuspenseQuery(lifeLogQuery)
  const latest = days[0]?.day

  return (
    <Card>
      <CardHeader>
        <CardTitle>Days</CardTitle>
        <CardDescription>
          {days.length
            ? `${days.length} day${days.length === 1 ? '' : 's'}, newest first. Tap a day to see its readings.`
            : 'There are no days with data yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="grid gap-1" aria-label="Days">
          {days.map((d) => (
            <li key={d.day}>
              <DayRow d={d} log={log} latest={d.day === latest} />
            </li>
          ))}
        </ul>
        {days.length >= count && count < MAX_DAYS ? (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={more.isFetching}
            onClick={() => setCount((c) => Math.min(MAX_DAYS, c + DAYS_SHOWN))}
          >
            {more.isFetching ? 'Loading' : `Show ${DAYS_SHOWN} earlier days`}
          </Button>
        ) : null}
        {days.length ? (
          <p className="text-xs text-muted-foreground">
            Sensor shows how much of the day had readings. Days with a tag from your life log are marked as not normal.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DayRow({ d, log, latest }: { d: DaySummary; log: LogEntry[]; latest: boolean }) {
  const tags = tagsOn(log, d.day)
  const notes = notesOn(log, d.day)
  const acts = activitiesOn(log, d.day)
  const hasData = d.readings > 0
  const [dow, num] = [weekdayShort(d.day), +d.day.slice(8, 10)]

  return (
    <Link
      to="/day"
      search={{ date: d.day }}
      aria-label={[
        longDate(d.day),
        hasData
          ? `${d.lows} ${d.lows === 1 ? 'low' : 'lows'}, ${Math.round(d.inRange)}% in range, sensor ${Math.min(100, Math.round(d.wear))}%`
          : 'no sensor data',
        tags.length ? `not a normal day: ${tags.map(tagLabel).join(', ')}` : '',
        acts.length ? `activity: ${acts.map((a) => a.text).join(', ')}` : '',
        notes.length ? (notes.length === 1 ? '1 note' : `${notes.length} notes`) : '',
      ]
        .filter(Boolean)
        .join(', ')}
      className="flex items-center gap-3 rounded-lg px-2 py-2 no-underline outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="grid w-9 shrink-0 justify-items-center leading-tight" aria-hidden="true">
        <span className="text-[11px] text-muted-foreground">{dow}</span>
        <span className="text-[15px] font-bold tabular-nums">{num}</span>
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        {hasData ? (
          <DayBar d={d} />
        ) : (
          <span className="flex h-3 items-center rounded-sm border border-dashed border-muted-foreground/40 px-1.5 text-[10px] text-muted-foreground">
            No sensor data
          </span>
        )}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
          {hasData ? (
            <>
              <span className={cn(d.lows > 0 && 'font-semibold text-foreground')}>
                {d.lows} {d.lows === 1 ? 'low' : 'lows'}
              </span>
              <span className="tabular-nums">{Math.round(d.inRange)}% in range</span>
              <span className="tabular-nums">Sensor {Math.min(100, Math.round(d.wear))}%</span>
            </>
          ) : (
            <span>Sensor gap</span>
          )}
          {latest ? <Badge variant="secondary">Latest</Badge> : null}
          {tags.length ? (
            <span className="inline-flex items-center gap-1 text-warn-ink">
              <Tag className="size-3" />
              {tags.map(tagLabel).join(', ')}
            </span>
          ) : null}
          {acts.length ? (
            <span className="inline-flex items-center gap-1 text-act">
              <Dumbbell className="size-3" />
              {acts.map((a) => a.text).join(', ')}
            </span>
          ) : null}
          {notes.length ? (
            <span className="inline-flex items-center gap-1">
              <StickyNote className="size-3" />
              {notes.length === 1 ? 'Note' : `${notes.length} notes`}
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

/** Below 3.9, in range and above 10.0 as one bar. Lows sit on the left. */
function DayBar({ d }: { d: DaySummary }) {
  const parts = [
    { band: 'low', pct: d.below39 },
    { band: 'in', pct: d.inRange },
    { band: 'high', pct: d.above10 },
  ].filter((p) => p.pct > 0)
  return (
    <span className="flex h-3 w-full overflow-hidden rounded-sm bg-muted" aria-hidden="true">
      {parts.map((p) => (
        <span
          key={p.band}
          className={cn('h-full', `band-fill-${p.band}`)}
          style={{ width: `${p.pct}%`, backgroundColor: `var(--band-${p.band})` }}
        />
      ))}
    </span>
  )
}
