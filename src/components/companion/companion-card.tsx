import { Link } from '@tanstack/react-router'
import { ChevronRight, Upload } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Card } from '#/components/ui/card'
import type { GameState } from '#/lib/glucose/game'
import { STAGES } from '#/lib/glucose/game'
import { cn } from '#/lib/utils'

import { CompanionSvg, petColor } from './companion-svg'

export interface Pet {
  name: string
  color: string
}

/** XP toward the next level as a bar plus "into of need XP". */
export function XpBar({ progress }: { progress: GameState }) {
  const { level, xp } = progress
  const pct = level.need > 0 ? Math.min(100, (level.into / level.need) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={level.need}
        aria-valuenow={level.into}
        aria-label={`XP toward level ${level.level + 1}`}
        className="h-2.5 overflow-hidden rounded-full bg-xp-soft"
      >
        <div
          className="h-full w-full rounded-full bg-xp transition-transform duration-(--dur-value) ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums">
          {level.into} of {level.need} XP
        </span>
        <span className="text-muted-foreground">{xp.toLocaleString('en-GB')} XP in total</span>
      </div>
    </div>
  )
}

/**
 * The companion with level and XP. Compact on Home (links to Progress), large
 * on the Progress overview. Mood and line come from imports, levels and
 * challenges only, never from glucose values.
 */
export function CompanionCard({
  progress,
  pet,
  large = false,
  className,
}: {
  progress: GameState
  pet: Pet
  large?: boolean
  className?: string
}) {
  const stage = Math.min(5, Math.max(1, progress.stage))
  const st = STAGES[stage - 1]
  const name = pet.name.trim() || 'Pip'
  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      <div className="flex items-center gap-3.5 px-4 pt-4 pb-3">
        <div
          className={cn(
            'grid shrink-0 place-items-center',
            large ? 'size-[120px] rounded-[26px] sm:size-[140px] sm:rounded-[28px]' : 'size-[96px] rounded-[22px]',
          )}
          style={{ background: `color-mix(in oklab, ${petColor(pet.color).body} 22%, var(--card))` }}
        >
          <CompanionSvg stage={stage} mood={progress.mood} color={pet.color} size={large ? 112 : 84} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-lg leading-tight font-extrabold tracking-tight wrap-anywhere">{name}</h2>
            <Badge variant="secondary" className="bg-xp-soft text-xp">
              Level {progress.level.level}
            </Badge>
          </div>
          <p
            className="relative rounded-xl bg-muted px-2.5 py-2 text-[13px] leading-snug before:absolute before:top-3 before:-left-1 before:size-2.5 before:rotate-45 before:rounded-[2px] before:bg-muted before:content-['']"
            aria-live="polite"
          >
            {progress.line}
          </p>
          <XpBar progress={progress} />
        </div>
      </div>
      {large ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {st.name} stage ({st.levels.toLowerCase()}).
            {st.growsAt ? ` ${name} grows again at level ${st.growsAt}.` : ''}
          </span>
          <span className="inline-flex items-center gap-1">
            <Upload aria-hidden="true" className="size-3" />
            Updates when you import
          </span>
        </div>
      ) : (
        <Link
          to="/progress"
          className="flex min-h-11 items-center justify-between gap-2 border-t px-4 py-2.5 text-xs no-underline transition-colors duration-(--dur-press) hover:bg-accent active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="text-muted-foreground">Updates when you import</span>
          <span className="inline-flex items-center gap-0.5 font-semibold">
            Progress
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </span>
        </Link>
      )}
    </Card>
  )
}
