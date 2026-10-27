import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Dumbbell, NotebookText, Plus, SlidersHorizontal, Tag } from 'lucide-react'
import { useState } from 'react'

import { SectionCard } from '#/components/home/section-card'
import { BackHead, NavRow } from '#/components/more/page-head'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { shortDate } from '#/lib/glucose/format'
import type { LogEntry } from '#/lib/glucose/lifelog'
import { lifeLogQuery } from '#/lib/queries'

import { ExcludeSwitch } from './exclude-switch'
import { LogAddSheet } from './log-add-sheet'
import type { AddType } from './log-add-sheet'
import {
  ByChip,
  DeleteEntry,
  activitySchedule,
  dateRangeText,
  dayCount,
  minClock,
  tagLabel,
} from './parts'

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <Plus aria-hidden="true" />
      Add
    </Button>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function TagList({ items }: { items: LogEntry[] }) {
  if (!items.length) return <Empty>No days tagged yet.</Empty>
  return (
    <ul className="flex flex-col divide-y">
      {items.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2.5">
          <span className="w-[5.5rem] shrink-0">
            <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
              {tagLabel(t.tag)}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">{dateRangeText(t.startDate, t.endDate)}</span>
            <span className="text-sm text-muted-foreground">
              {dayCount(t.startDate, t.endDate)}
              {t.text ? `. ${t.text}` : ''}
            </span>
          </span>
          <ByChip author={t.author} />
          <DeleteEntry
            id={t.id}
            what={`${tagLabel(t.tag).toLowerCase()}, ${dateRangeText(t.startDate, t.endDate)}`}
          />
        </li>
      ))}
    </ul>
  )
}

function ActivityList({ items }: { items: LogEntry[] }) {
  if (!items.length) return <Empty>No activities yet. Add one that repeats every week, like a sport.</Empty>
  return (
    <ul className="flex flex-col divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-1">
          <Link
            to="/log/activity/$activityId"
            params={{ activityId: String(a.id) }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2.5 text-foreground no-underline transition-colors duration-(--dur-press) hover:bg-accent active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-act-wash text-act">
              <Dumbbell aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">{a.text}</span>
              <span className="text-sm text-muted-foreground">
                {activitySchedule(a)}. From {shortDate(a.startDate)}
                {a.endDate ? ` to ${shortDate(a.endDate)}` : ', no end date'}.
              </span>
            </span>
            <ByChip author={a.author} />
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Link>
          <DeleteEntry id={a.id} what={`the activity ${a.text}`} />
        </li>
      ))}
    </ul>
  )
}

function NoteList({ items }: { items: LogEntry[] }) {
  if (!items.length) return <Empty>No notes yet.</Empty>
  return (
    <ul className="flex flex-col divide-y">
      {items.map((n) => (
        <li key={n.id} className="flex items-start gap-3 py-2.5">
          <Link
            to="/day"
            search={{ date: n.startDate }}
            className="flex w-[5.5rem] shrink-0 flex-col text-foreground underline-offset-2 hover:underline"
            aria-label={`Open ${shortDate(n.startDate)}${n.atMin !== null ? ` at ${minClock(n.atMin)}` : ''}`}
          >
            <span className="font-semibold">{shortDate(n.startDate)}</span>
            {n.atMin !== null ? (
              <span className="text-sm text-muted-foreground tabular-nums">{minClock(n.atMin)}</span>
            ) : null}
          </Link>
          <span className="min-w-0 flex-1 text-sm leading-relaxed">{n.text}</span>
          <ByChip author={n.author} />
          <DeleteEntry id={n.id} what={`the note on ${shortDate(n.startDate)}`} />
        </li>
      ))}
    </ul>
  )
}

export function LogView() {
  const { data } = useSuspenseQuery(lifeLogQuery)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AddType>('tag')
  const openAdd = (t: AddType) => {
    setType(t)
    setOpen(true)
  }

  const tags = data.filter((e) => e.kind === 'tag')
  const activities = data.filter((e) => e.kind === 'activity')
  const notes = data.filter((e) => e.kind === 'note')

  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-4">
      <BackHead
        back="More"
        backTo={{ to: '/more' }}
        title="Life log"
        sub="Mark days that were not normal, add notes, and log activities that repeat. You and your parent can both add things."
        action={
          <Button size="sm" onClick={() => openAdd('tag')}>
            <Plus aria-hidden="true" />
            Add
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card className="py-4">
            <CardContent className="px-4 sm:px-6">
              <ExcludeSwitch />
            </CardContent>
          </Card>
          <SectionCard
            title="Not-normal days"
            icon={Tag}
            description="Sick, vacation, period, school break or other."
            action={<AddButton label="Add not-normal days" onClick={() => openAdd('tag')} />}
          >
            <TagList items={tags} />
          </SectionCard>
          <SectionCard
            title="Activities"
            icon={Dumbbell}
            description="On a weekly schedule. Tap one to compare with other days."
            action={<AddButton label="Add an activity" onClick={() => openAdd('activity')} />}
          >
            <ActivityList items={activities} />
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Notes"
            icon={NotebookText}
            description="One-off notes on a day."
            action={<AddButton label="Add a note" onClick={() => openAdd('note')} />}
          >
            <NoteList items={notes} />
          </SectionCard>
          <Card className="py-2">
            <CardContent className="px-2">
              <NavRow
                to={{ to: '/trends', search: { tab: 'changes' } }}
                icon={<SlidersHorizontal />}
                title="Settings changes"
                sub="Pump changes and clinic visits live in Trends, Changes."
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <LogAddSheet open={open} onOpenChange={setOpen} type={type} onTypeChange={setType} />
    </div>
  )
}
