import { Link } from '@tanstack/react-router'
import { ChevronRight, Clock, Stethoscope } from 'lucide-react'

import { KindBadge } from '#/components/glucose/band'
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
import type { Pattern } from '#/lib/glucose/patterns'
import { cn } from '#/lib/utils'

import { PatternChart } from './pattern-chart'
import { SaveQuestionButton } from './saved-questions'

const STRENGTH: Record<Pattern['strength'], string> = {
  3: 'Strong evidence',
  2: 'Some evidence',
  1: 'Early sign',
}

export const patternCardId = (id: string) => `pattern-${id}`

function StrengthMeter({ level, note }: { level: Pattern['strength']; note: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
        {[7, 10, 13].map((h, i) => (
          <span
            key={h}
            className={cn('w-[5px] rounded-[2px]', i < level ? 'bg-foreground' : 'bg-border')}
            style={{ height: h }}
          />
        ))}
      </span>
      <span className="font-medium">{STRENGTH[level]}</span>
      <span className="basis-full text-muted-foreground">{note}</span>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
      {children}
    </div>
  )
}

export function PatternCard({ pattern: p, focused }: { pattern: Pattern; focused: boolean }) {
  return (
    <Card
      id={patternCardId(p.id)}
      tabIndex={-1}
      className={cn(
        '@container scroll-mt-20 gap-4 outline-none transition-shadow duration-500',
        focused && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
      )}
    >
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="leading-snug">
          <h2>{p.title}</h2>
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {p.when}
        </CardDescription>
        <CardAction>
          <KindBadge kind={p.kind} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 px-4 sm:px-6 @3xl:grid-cols-2">
        <div className="flex flex-col gap-2.5 text-sm leading-relaxed @3xl:col-start-1 @3xl:row-start-1">
          <p>{p.evidence}</p>
          {p.extra ? <p className="text-muted-foreground">{p.extra}</p> : null}
          <StrengthMeter level={p.strength} note={p.strengthNote} />
        </div>

        <figure className="m-0 flex min-w-0 flex-col gap-1.5 rounded-lg bg-muted/55 p-3 @3xl:col-start-2 @3xl:row-span-2 @3xl:row-start-1">
          <PatternChart chart={p.chart} />
          <figcaption className="text-[13px]">{p.caption}</figcaption>
        </figure>

        <div className="@3xl:col-start-1 @3xl:row-start-2">
          <Eyebrow>Areas your team may look at</Eyebrow>
          <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label="Areas your team may look at">
            {p.topics.map((t) => (
              <li key={t}>
                <Badge variant="secondary">{t}</Badge>
              </li>
            ))}
          </ul>
          {p.topicsNote ? <p className="text-sm text-muted-foreground">{p.topicsNote}</p> : null}
        </div>

        <div className="rounded-xl border bg-background p-3.5 @3xl:col-span-2">
          <Eyebrow>
            <Stethoscope className="size-3.5" aria-hidden="true" />
            Question for the care team
          </Eyebrow>
          <p className="mb-3 text-[14.5px] font-medium leading-normal">{p.question}</p>
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
        </div>
      </CardContent>
    </Card>
  )
}
