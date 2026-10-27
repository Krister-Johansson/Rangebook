import { Link } from '@tanstack/react-router'
import { Upload } from 'lucide-react'

import { CompanionSvg, petColor } from '#/components/companion/companion-svg'
import { BADGE_ICONS, Medal } from '#/components/progress/parts'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { rangeLabel } from '#/lib/glucose/format'
import { STAGES } from '#/lib/glucose/game'
import type { BadgeState, GameState, Tier } from '#/lib/glucose/game'

export interface ImportDone {
  /** Progress before the upload, or null when it was another person or there was none. */
  before: GameState | null
  after: GameState | null
  pet: { name: string; color: string }
  from: string | null
  to: string | null
}

/** Badge tiers in `after` that were not earned in `before`. */
function newBadges(before: GameState | null, after: GameState) {
  const out: { badge: BadgeState; tier: Tier }[] = []
  for (const b of after.badges) {
    const earlier = before?.badges.find((x) => x.id === b.id)
    for (const e of b.earned) {
      const had = earlier ? earlier.earned.some((x) => x.tier === e.tier) : !e.fresh
      if (!had) out.push({ badge: b, tier: e.tier })
    }
  }
  return out
}

const TIER_LABEL: Record<Tier, string> = { bronze: 'bronze', silver: 'silver', gold: 'gold' }

export function ImportDoneSheet({
  done,
  onOpenChange,
}: {
  done: ImportDone | null
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const after = done?.after ?? null
  const before = done?.before ?? null
  const name = done?.pet.name.trim() || 'Pip'
  const color = done?.pet.color ?? 'sky'

  const gained = after ? Math.max(0, after.xp - (before?.xp ?? 0)) : 0
  const leveled = after && before ? after.level.level > before.level.level : false
  const grew = after && before ? after.stage > before.stage : false
  const badges = after ? newBadges(before, after) : []
  const close = () => onOpenChange(false)

  return (
    <Sheet open={!!done} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile ? 'max-h-[92dvh] overflow-y-auto rounded-t-2xl' : 'w-full overflow-y-auto sm:max-w-md'
        }
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Import done</SheetTitle>
          <SheetDescription>
            {done?.from && done.to ? `The export covers ${rangeLabel(done.from, done.to)}. ` : ''}
            Days you already imported do not count twice.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <div className="flex items-center gap-4">
            <div
              className="grid size-[120px] shrink-0 place-items-center rounded-[26px]"
              style={{ background: `color-mix(in oklab, ${petColor(color).body} 22%, var(--card))` }}
            >
              <CompanionSvg stage={after?.stage ?? 1} mood="celebrating" color={color} size={108} />
            </div>
            <div className="flex min-w-0 flex-col gap-1" aria-live="polite">
              {after ? (
                <>
                  <span className="text-2xl font-extrabold tracking-tight">
                    {leveled ? `Level ${after.level.level}` : gained > 0 ? `+${gained} XP` : 'All caught up'}
                  </span>
                  <span className="text-sm wrap-anywhere text-muted-foreground">
                    {leveled
                      ? `${name} leveled up with you.`
                      : gained > 0
                        ? `${name} is happy you imported.`
                        : 'No new XP this time.'}
                    {grew ? ` ${name} grew into a ${STAGES[after.stage - 1].name.toLowerCase()}.` : ''}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Progress shows up once there are sensor readings.
                </span>
              )}
            </div>
          </div>

          {after ? (
            <dl className="flex flex-col divide-y rounded-lg border text-sm">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt>{before ? 'XP from this import' : 'XP in total'}</dt>
                <dd className="font-semibold tabular-nums">
                  {before ? `+${gained}` : after.xp.toLocaleString('en-GB')} XP
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt>Level</dt>
                <dd className="font-semibold tabular-nums">
                  {leveled && before ? `${before.level.level} to ${after.level.level}` : after.level.level}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt>To the next level</dt>
                <dd className="tabular-nums">{after.level.left} XP</dd>
              </div>
            </dl>
          ) : null}

          {badges.length ? (
            <section aria-label="New badges" className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-muted-foreground">
                {badges.length === 1 ? 'New badge' : 'New badges'}
              </h3>
              <ul className="flex flex-col gap-2">
                {badges.map(({ badge, tier }) => (
                  <li key={`${badge.id}-${tier}`} className="flex items-center gap-3">
                    <Medal tier={tier} state="earned" icon={BADGE_ICONS[badge.id]} size={36} />
                    <span className="flex flex-col">
                      <span className="font-semibold">
                        {badge.name}, {TIER_LABEL[tier]}
                      </span>
                      <span className="text-xs text-muted-foreground">{badge.what}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload aria-hidden="true" className="size-3" />
            XP, badges, challenges and personal bests update when you import.
          </p>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link to="/progress" onClick={close}>
              See progress
            </Link>
          </Button>
          <Button asChild>
            <Link to="/" onClick={close}>
              Home
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
