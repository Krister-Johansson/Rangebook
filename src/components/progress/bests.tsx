import { Link } from '@tanstack/react-router'
import { ChevronRight, Sparkles, Star } from 'lucide-react'

import { Card } from '#/components/ui/card'
import type { GameState } from '#/lib/glucose/game'
import { cn } from '#/lib/utils'

import { NewDot } from './parts'

export function ProgressBests({ progress }: { progress: GameState }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Compared only with your own history, never with anyone else. A new best gets a celebration.
        Nothing happens when a week is not a best.
      </p>
      {progress.bests.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {progress.bests.map((b) => {
            const Icon = b.fresh ? Sparkles : Star
            return (
              <li key={b.id}>
                <Card className={cn('h-full gap-1.5 p-4', b.fresh && 'border-xp/50 ring-1 ring-xp/30')}>
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground',
                        b.fresh && 'bg-xp-soft text-xp',
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <h3 className="flex-1 text-xs font-semibold text-muted-foreground">{b.label}</h3>
                    {b.fresh ? <NewDot /> : null}
                  </div>
                  <div className="text-2xl leading-tight font-extrabold tracking-tight tabular-nums">
                    {b.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{b.sub}</div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <span>{b.date}</span>
                    {b.day ? (
                      <Link
                        to="/day"
                        search={{ date: b.day }}
                        className="inline-flex min-h-8 items-center gap-0.5 font-semibold underline-offset-4 hover:underline"
                      >
                        See day
                        <ChevronRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm">Personal bests show up after a few weeks of data.</p>
      )}
      <p className="text-xs text-muted-foreground">
        "New" means it was set in the latest import. Bests update when you import.
      </p>
    </div>
  )
}
