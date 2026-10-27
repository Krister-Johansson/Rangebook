import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '#/components/ui/button'
import { ScrollArea, ScrollBar } from '#/components/ui/scroll-area'
import type { DaySummary } from '#/lib/glucose/analysis'
import { longDate } from '#/lib/glucose/format'
import { cn } from '#/lib/utils'

export function DayPicker({
  days,
  current,
  prev,
  next,
  insulin,
}: {
  days: DaySummary[]
  current: string
  prev: string | null
  next: string | null
  insulin: boolean
}) {
  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const selectedRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])

  return (
    <nav aria-label="Pick a day" className="flex min-w-0 items-center gap-1.5">
      <StepButton to={prev} insulin={insulin} label="Previous day">
        <ChevronLeft />
      </StepButton>
      <ScrollArea className="min-w-0 flex-1">
        <ul className="flex gap-1 p-0.5 pb-2.5">
          {ordered.map((d) => {
            const selected = d.day === current
            const [dow, date] = d.label.split(' ')
            const hasData = d.readings > 0
            return (
              <li key={d.day} className="shrink-0">
                <Link
                  ref={selected ? selectedRef : undefined}
                  to="/day"
                  search={{ date: d.day, insulin }}
                  aria-current={selected ? 'date' : undefined}
                  aria-label={`${longDate(d.day)}, ${hasData ? `${Math.round(d.inRange)}% in range` : 'no sensor readings'}`}
                  className={cn(
                    'flex min-h-14 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border bg-background px-0.5 py-1.5 no-underline outline-none transition-colors duration-(--dur-press) hover:bg-accent active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    selected && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
                  )}
                >
                  <span className="text-[11px] font-semibold opacity-80">{dow}</span>
                  <span className="text-[15px] leading-tight font-extrabold">{date}</span>
                  <span className={cn('text-[10.5px] tabular-nums', !selected && 'text-muted-foreground')}>
                    {hasData ? `${Math.round(d.inRange)}%` : 'none'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <StepButton to={next} insulin={insulin} label="Next day">
        <ChevronRight />
      </StepButton>
    </nav>
  )
}

function StepButton({
  to,
  insulin,
  label,
  children,
}: {
  to: string | null
  insulin: boolean
  label: string
  children: React.ReactNode
}) {
  if (!to) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label}>
        {children}
      </Button>
    )
  }
  return (
    <Button variant="outline" size="icon" asChild>
      <Link to="/day" search={{ date: to, insulin }} aria-label={label}>
        {children}
      </Link>
    </Button>
  )
}
