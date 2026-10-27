import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Dumbbell, Info, PauseCircle, Plus, StickyNote, Tag } from 'lucide-react'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { BandSwatch } from '#/components/glucose/band'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Switch } from '#/components/ui/switch'
import type { DayDetail } from '#/lib/glucose/analysis'
import { BANDS } from '#/lib/glucose/core'
import type { Band } from '#/lib/glucose/core'
import { f1, longDate, perDay } from '#/lib/glucose/format'
import type { LogEntry } from '#/lib/glucose/lifelog'
import { dayQuery, daysQuery, lifeLogQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { AuthorChip } from '#/components/changes/what-changed'
import type { LogBand } from '#/components/trends/log-bands'
import { activitiesOn, dayBands, minuteLabel, notesOn, tagLabel, tagsOn } from '#/components/trends/log-bands'

import { AddNoteSheet } from './add-note-sheet'

import { BasalLane, BolusLane, EventLane, GlucoseChart } from './day-chart'
import { DayEvents } from './day-events'
import { DayPicker } from './day-picker'

const routeApi = getRouteApi('/day')

export function DayView() {
  const { date, insulin } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { data: day } = useSuspenseQuery(dayQuery(date))
  const { data: days } = useSuspenseQuery(daysQuery(14))
  const { data: log } = useSuspenseQuery(lifeLogQuery)

  if (!day) return null
  const bands = dayBands(log, day.day)
  const s = day.summary
  const hasReadings = day.readings.length > 0
  const latest = day.next === null
  const stopped = day.basal.some((b) => b.suspend && b.end - b.t >= 0.5)

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-4">
      <div className="grid gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Day</h1>
        <DayPicker days={days} current={day.day} prev={day.prev} next={day.next} insulin={insulin} />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{longDate(day.day)}</CardTitle>
          <CardDescription>
            {hasReadings
              ? `Sensor readings for ${Math.round(s.wear)}% of the day, ${day.weekend ? 'weekend' : 'school day'}. mmol/L.`
              : 'No sensor readings this day.'}
          </CardDescription>
          {latest ? (
            <CardAction>
              <Badge variant="secondary">Latest day</Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {hasReadings ? (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat band="in" label="In range" value={`${Math.round(s.inRange)}%`} sub={`about ${perDay(s.inRange)}`} />
              <Stat label="Average" value={f1(s.mean)} sub="mmol/L" />
              <Stat
                band="low"
                label={s.lows === 1 ? 'Low' : 'Lows'}
                value={String(s.lows)}
                sub={`${s.below39.toFixed(1)}% below 3.9`}
              />
              <Stat band="high" label="Above range" value={`${Math.round(s.above10)}%`} sub={`about ${perDay(s.above10)}`} />
            </dl>
          ) : null}

          {day.notes.length ? (
            <Alert>
              {stopped ? <PauseCircle /> : <Info />}
              <AlertTitle>About this day</AlertTitle>
              <AlertDescription>
                <ul className="grid gap-0.5">
                  {day.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid min-w-0 gap-1">
            <GlucoseChart day={day} logBands={bands} />
            {insulin ? <Lanes day={day} /> : null}
          </div>

          <DayLegend day={day} insulin={insulin} bands={bands} />

          <Separator />
          <div className="flex items-start gap-3">
            <Switch
              id="day-lanes"
              checked={insulin}
              onCheckedChange={(v) => navigate({ search: (prev) => ({ ...prev, insulin: v }), replace: true })}
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <Label htmlFor="day-lanes">Show insulin and carbs</Label>
              <p className="text-xs text-muted-foreground">Boluses, carbs entered, basal and pump alarms.</p>
            </div>
          </div>

          {insulin ? <DayEvents day={day} /> : null}
        </CardContent>
      </Card>

      <DayNotes day={day.day} log={log} />
    </div>
  )
}

function DayNotes({ day, log }: { day: string; log: LogEntry[] }) {
  const [adding, setAdding] = useState(false)
  const tags = tagsOn(log, day)
  const acts = activitiesOn(log, day)
  const notes = notesOn(log, day)
  const empty = !tags.length && !acts.length && !notes.length

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="size-4" aria-hidden="true" />
          Notes for this day
        </CardTitle>
        <CardDescription>From your life log.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add note
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged. A note helps explain a day that looks different, like a sports day or a late party.
          </p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {tags.map((t) => (
              <li key={`t-${t.id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-warn-line bg-warn-bg px-2.5 py-1.5 text-warn-ink">
                <Tag className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">Not a normal day:</span> {tagLabel(t)}
                </span>
                <AuthorChip author={t.author} />
              </li>
            ))}
            {acts.map((a) => (
              <li key={`a-${a.id}`} className="flex flex-wrap items-center gap-2 px-1 py-1">
                <Dumbbell className="size-3.5 shrink-0 text-act" aria-hidden="true" />
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {minuteLabel(a.startMin ?? 0)} to {minuteLabel(a.endMin ?? 0)}
                </span>
                <span className="min-w-0 flex-1">{a.text}, every week</span>
              </li>
            ))}
            {notes.map((n) => (
              <li key={`n-${n.id}`} className="flex flex-wrap items-start gap-2 border-t px-1 pt-2">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                  {n.atMin === null ? 'Day' : minuteLabel(n.atMin)}
                </span>
                <span className="min-w-0 flex-1">{n.text}</span>
                <AuthorChip author={n.author} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AddNoteSheet day={day} open={adding} onOpenChange={setAdding} />
    </Card>
  )
}

function Stat({ label, value, sub, band }: { label: string; value: string; sub?: string; band?: Band }) {
  return (
    <div className="grid gap-0.5 rounded-lg border px-3 py-2">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {band ? <BandSwatch band={band} /> : null}
        {label}
      </dt>
      <dd className="text-xl leading-tight font-bold tabular-nums">{value}</dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  )
}

function Lanes({ day }: { day: DayDetail }) {
  return (
    <div className="grid min-w-0 gap-1 pt-2">
      <LaneTitle>Boluses and carbs</LaneTitle>
      {day.boluses.length ? <BolusLane boluses={day.boluses} /> : <LaneEmpty>No boluses this day.</LaneEmpty>}
      <LaneTitle>Basal (U/h)</LaneTitle>
      {day.basal.length ? <BasalLane basal={day.basal} /> : <LaneEmpty>No basal data this day.</LaneEmpty>}
      <LaneTitle>Alarms and pump events</LaneTitle>
      {day.alarms.length ? <EventLane alarms={day.alarms} /> : <LaneEmpty>No alarms this day.</LaneEmpty>}
    </div>
  )
}

function LaneTitle({ children }: { children: ReactNode }) {
  return <div className="pl-[34px] text-xs font-semibold">{children}</div>
}

function LaneEmpty({ children }: { children: ReactNode }) {
  return <p className="pb-2 pl-[34px] text-xs text-muted-foreground">{children}</p>
}

function Swatch({ style, className }: { style?: CSSProperties; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-3 shrink-0 rounded-[3px]', className)} style={style} />
}

function DayLegend({ day, insulin, bands }: { day: DayDetail; insulin: boolean; bands: LogBand[] }) {
  const hasStop = day.basal.some((b) => b.suspend && b.end - b.t >= 5 / 60)
  const hasHi = day.readings.some((r) => r.limit === 'high')
  const hasLo = day.readings.some((r) => r.limit === 'low')
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {[...BANDS].reverse().map((b) => (
        <li key={b.key} className="inline-flex items-center gap-1.5">
          <BandSwatch band={b.key} shape="line" className="h-[3px] w-4" />
          {b.label} ({b.range})
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <Swatch style={{ background: 'var(--target-wash)', boxShadow: 'inset 0 0 0 1.5px var(--band-in)' }} />
        Target 3.9 to 10.0
      </li>
      {day.gaps.length ? (
        <li className="inline-flex items-center gap-1.5">
          <Swatch className="bg-muted" />
          No sensor data
        </li>
      ) : null}
      {hasHi ? (
        <li className="inline-flex items-center gap-1.5">
          <Swatch style={{ background: 'color-mix(in oklab, var(--band-vhigh) 35%, transparent)' }} />
          HI: above 22.2, the sensor limit
        </li>
      ) : null}
      {hasLo ? (
        <li className="inline-flex items-center gap-1.5">
          <Swatch style={{ background: 'color-mix(in oklab, var(--band-vlow) 35%, transparent)' }} />
          LO: below the sensor limit
        </li>
      ) : null}
      {hasStop ? (
        <li className="inline-flex items-center gap-1.5">
          <Swatch
            className="border border-muted-foreground/60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--muted-foreground) 0 1.5px, var(--muted) 1.5px 5px)',
            }}
          />
          Pump stopped
        </li>
      ) : null}
      {bands.some((b) => b.kind === 'tag') ? (
        <li className="inline-flex items-center gap-1.5">
          <Swatch style={{ background: 'var(--warn-bg)', boxShadow: 'inset 0 0 0 1px var(--warn-line)' }} />
          Not a normal day (life log)
        </li>
      ) : null}
      {bands
        .filter((b) => b.kind === 'act')
        .map((b) => (
          <li key={b.key} className="inline-flex items-center gap-1.5">
            <Swatch style={{ background: 'var(--act-wash)', boxShadow: 'inset 0 0 0 1.5px var(--act)' }} />
            {b.label}
          </li>
        ))}
      {bands.some((b) => b.kind === 'note') ? (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0 shrink-0 border-l-2 border-dashed border-foreground" />
          Note
        </li>
      ) : null}
      {insulin ? (
        <>
          <li className="inline-flex items-center gap-1.5">
            <Swatch className="w-2 bg-foreground" />
            Bolus with carbs (grams above)
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Swatch className="w-2 border-[1.5px] border-foreground bg-background" />
            Bolus, no carbs entered
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Swatch className="w-1 bg-muted-foreground" />
            Automatic correction (estimated)
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Swatch style={{ background: 'var(--basal)' }} className="border border-muted-foreground" />
            Basal rate
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="mx-0.5 inline-block size-2.5 rotate-45 border-[1.5px] border-foreground bg-background" />
            Alarm or pump event
          </li>
        </>
      ) : null}
    </ul>
  )
}
