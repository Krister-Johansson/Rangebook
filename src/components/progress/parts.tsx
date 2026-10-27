import type { LucideIcon } from 'lucide-react'
import {
  CalendarCheck,
  Check,
  Flag,
  Lock,
  Radio,
  School,
  Sparkles,
  Star,
  Stethoscope,
  Utensils,
} from 'lucide-react'

import type { BadgeId, ChallengeId, ChallengeProgress, Tier } from '#/lib/glucose/game'
import { CHALLENGES } from '#/lib/glucose/game'
import { cn } from '#/lib/utils'

export const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  fullweek: CalendarCheck,
  meal: Utensils,
  lunch: School,
  challenger: Flag,
  clinic: Stethoscope,
  bests: Star,
}

export const CHALLENGE_ICONS: Record<ChallengeId, LucideIcon> = {
  meals: Utensils,
  wear: Radio,
  lunch: School,
  clinic: Stethoscope,
}

export const challengeById = (id: ChallengeId) => CHALLENGES.find((c) => c.id === id)!

/** Progress bar classes in XP colors (shadcn Progress). */
export const XP_PROGRESS = 'bg-xp-soft *:data-[slot=progress-indicator]:bg-xp'

const TIER_BG: Record<Tier, string> = { bronze: 'bg-bronze', silver: 'bg-silver', gold: 'bg-gold' }
const TIER_BORDER: Record<Tier, string> = {
  bronze: 'border-bronze',
  silver: 'border-silver',
  gold: 'border-gold',
}

/** One badge tier. Earned is filled, next has a dashed ring, locked shows a lock. */
export function Medal({
  tier,
  state,
  icon: Icon,
  size = 44,
}: {
  tier: Tier
  state: 'earned' | 'next' | 'locked'
  icon: LucideIcon
  size?: number
}) {
  const Glyph = state === 'locked' ? Lock : Icon
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full',
        state === 'earned' &&
          cn(TIER_BG[tier], 'text-medal-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.12)]'),
        state === 'next' && cn('border-2 border-dashed bg-card text-muted-foreground', TIER_BORDER[tier]),
        state === 'locked' && 'bg-muted text-muted-foreground opacity-80',
      )}
      style={{ width: size, height: size }}
    >
      <Glyph style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4) }} />
    </span>
  )
}

export function NewDot({ children = 'New' }: { children?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-xp-soft px-1.5 py-px text-[11px] font-bold whitespace-nowrap text-xp">
      <Sparkles aria-hidden="true" className="size-[11px]" />
      {children}
    </span>
  )
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Marks and labels for a challenge. Clinic prep counts questions, not days. */
export function challengeMarks(p: ChallengeProgress): { marks: (boolean | null)[]; labels: string[] } {
  if (p.id === 'clinic') {
    const marks = Array.from({ length: p.target }, (_, i) => (i < p.done ? true : null))
    return { marks, labels: marks.map((_, i) => (i === 0 ? '1st' : i === 1 ? '2nd' : `${i + 1}th`)) }
  }
  return { marks: p.marks, labels: WEEK.slice(0, p.marks.length) }
}

/** "n of N" as squares, one per day. Checked counted, grey not counted, dashed not yet. */
export function DayMarks({ progress, small = false }: { progress: ChallengeProgress; small?: boolean }) {
  const { marks, labels } = challengeMarks(progress)
  const counted = marks.filter((m) => m === true).length
  const open = marks.filter((m) => m === null).length
  return (
    <div
      role="img"
      aria-label={`${counted} of ${marks.length} counted so far${open ? `, ${open} still open` : ''}`}
      className="flex flex-wrap gap-1.5"
    >
      {marks.map((m, i) => (
        <span key={i} className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              'grid place-items-center rounded-lg border-[1.5px]',
              small ? 'size-6' : 'size-7',
              m === true && 'border-xp bg-xp text-white dark:text-[oklch(0.2_0.03_285)]',
              m === false && 'border-muted bg-muted',
              m === null && 'border-dashed border-border',
            )}
          >
            {m === true ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
          </span>
          {!small ? (
            <span className="text-[10.5px] font-semibold text-muted-foreground">{labels[i]}</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}
