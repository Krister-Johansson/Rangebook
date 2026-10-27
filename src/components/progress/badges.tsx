import { Upload } from 'lucide-react'

import { Card } from '#/components/ui/card'
import { Progress } from '#/components/ui/progress'
import type { BadgeState, GameState } from '#/lib/glucose/game'
import { TIERS } from '#/lib/glucose/game'
import { shortDate } from '#/lib/glucose/format'
import { cn } from '#/lib/utils'

import { BADGE_ICONS, Medal, NewDot, XP_PROGRESS } from './parts'

const SINGULAR: Record<string, string> = { boluses: 'bolus', lunches: 'lunch' }
/** "1 week", "4 weeks". */
export const unitFor = (n: number, unit: string) => (n === 1 ? (SINGULAR[unit] ?? unit.replace(/s$/, '')) : unit)

export const weekOf = (weekStart: string) => `week of ${shortDate(weekStart).replace(/^\w+ /, '')}`

function BadgeCard({ badge }: { badge: BadgeState }) {
  const got = badge.earned.length
  const fresh = badge.earned.some((e) => e.fresh)
  const icon = BADGE_ICONS[badge.id]
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="flex flex-wrap items-center gap-2 font-semibold">
          {badge.name}
          {fresh ? <NewDot /> : null}
        </h3>
        <p className="text-xs text-muted-foreground">{badge.what}</p>
      </div>
      <ul className="grid grid-cols-3 gap-2" aria-label={`${badge.name} tiers`}>
        {TIERS.map((tier, i) => {
          const state = i < got ? 'earned' : i === got ? 'next' : 'locked'
          const earned = badge.earned[i]
          return (
            <li
              key={tier}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center',
                state === 'earned' && 'bg-muted/60',
              )}
            >
              <Medal tier={tier} state={state} icon={icon} />
              <span className="text-xs font-semibold capitalize">{tier}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {badge.tiers[i]} {unitFor(badge.tiers[i], badge.unit)}
              </span>
              <span className="sr-only">
                {state === 'earned'
                  ? `Earned in the ${weekOf(earned.weekStart)}.`
                  : state === 'next'
                    ? 'Next to earn.'
                    : 'Locked.'}
              </span>
            </li>
          )
        })}
      </ul>
      {badge.next ? (
        <div className="flex flex-col gap-1.5">
          <Progress
            value={Math.min(100, (badge.count / badge.next.target) * 100)}
            aria-label={`${badge.name} toward ${badge.next.tier}`}
            className={XP_PROGRESS}
          />
          <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
            <span className="font-semibold tabular-nums">
              {Math.min(badge.count, badge.next.target)} of {badge.next.target}
            </span>
            <span className="text-muted-foreground">
              {unitFor(badge.next.target, badge.unit)} for {badge.next.tier}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs font-semibold">All three tiers earned.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {got
          ? `Earned: ${badge.earned.map((e) => `${e.tier} in the ${weekOf(e.weekStart)}`).join(', ')}.`
          : 'Not earned yet.'}
      </p>
    </Card>
  )
}

export function ProgressBadges({ progress }: { progress: GameState }) {
  const earned = progress.badges.reduce((n, b) => n + b.earned.length, 0)
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>
          {earned} of {progress.badges.length * 3} badges earned. Each tier gives 25 XP.
        </span>
        <span className="inline-flex items-center gap-1">
          <Upload aria-hidden="true" className="size-3" />
          Updates when you import
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {progress.badges.map((b) => (
          <BadgeCard key={b.id} badge={b} />
        ))}
      </div>
    </div>
  )
}
