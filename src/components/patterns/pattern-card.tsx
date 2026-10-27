import { ChevronRight, Stethoscope } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import type { Pattern } from '#/lib/glucose/patterns'
import { cn } from '#/lib/utils'

import { PatternChart } from './pattern-chart'
import { SaveQuestionButton } from './saved-questions'

const STRENGTH: Record<Pattern['strength'], string> = {
  3: 'Strong evidence',
  2: 'Some evidence',
  1: 'Early sign',
}

/** Three bars for how strong the evidence is, always with the words next to it. */
export function StrengthMeter({
  level,
  note,
  compact = false,
}: {
  level: Pattern['strength']
  note?: string
  compact?: boolean
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
        {[7, 10, 13].map((h, i) => (
          <span
            key={h}
            className={cn('w-[5px] rounded-[2px]', i < level ? 'bg-foreground' : 'bg-border')}
            style={{ height: compact ? h - 2 : h }}
          />
        ))}
      </span>
      <span className={compact ? 'text-xs font-semibold' : 'font-medium'}>{STRENGTH[level]}</span>
      {note ? <span className="basis-full text-muted-foreground">{note}</span> : null}
    </span>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
      {children}
    </div>
  )
}

/** Evidence, strength and chart for one pattern. */
export function PatternMain({ pattern: p, days }: { pattern: Pattern; days: number }) {
  return (
    <Card className="gap-4 py-5">
      <CardContent className="flex flex-col gap-3 px-4 text-sm leading-relaxed sm:px-6">
        <p>{p.evidence}</p>
        {p.extra ? <p className="text-muted-foreground">{p.extra}</p> : null}
        <StrengthMeter level={p.strength} note={p.strengthNote} />
        <figure className="m-0 flex min-w-0 flex-col gap-1.5 rounded-lg bg-muted/55 p-3">
          <PatternChart chart={p.chart} />
          <figcaption className="text-[13px]">
            {p.caption} Last {days} days.
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  )
}

/** The question for the care team with Save for clinic. */
export function PatternQuestion({ pattern: p }: { pattern: Pattern }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Eyebrow>
        <Stethoscope className="size-3.5" aria-hidden="true" />
        Question for the care team
      </Eyebrow>
      <p className="mb-3 text-[15px] leading-normal font-medium">{p.question}</p>
      <div className="flex flex-wrap gap-2">
        <SaveQuestionButton patternId={p.id} question={p.question} />
        {p.exampleDay ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/day" search={{ date: p.exampleDay }}>
              See an example day
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Saving gives 5 XP, once per question. It waits in For clinic until your visit.
      </p>
    </div>
  )
}

/** Areas the care team may look at. */
export function PatternTopics({ pattern: p }: { pattern: Pattern }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4 sm:px-5">
        <Eyebrow>Areas your team may look at</Eyebrow>
        <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label="Areas your team may look at">
          {p.topics.map((t) => (
            <li key={t}>
              <Badge variant="secondary">{t}</Badge>
            </li>
          ))}
        </ul>
        {p.topicsNote ? <p className="text-sm text-muted-foreground">{p.topicsNote}</p> : null}
      </CardContent>
    </Card>
  )
}
