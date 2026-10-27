import { Link } from '@tanstack/react-router'
import { ChevronRight, Flag } from 'lucide-react'

import { DayMarks, XP_PROGRESS, challengeById } from '#/components/progress/parts'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import type { GameState } from '#/lib/glucose/game'

import { SectionCard } from './section-card'

function ChallengesLink({ children }: { children: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/progress" search={{ tab: 'challenges' }}>
        {children}
        <ChevronRight />
      </Link>
    </Button>
  )
}

/** This week's challenge on Home, or a prompt to pick one. */
export function ChallengeCard({ progress, className }: { progress: GameState; className?: string }) {
  const week = progress.thisWeek
  const picked = week.pick ? challengeById(week.pick) : null
  const p = week.pick ? week.progress.find((x) => x.id === week.pick) : undefined

  if (!picked || !p) {
    return (
      <SectionCard
        title="This week's challenge"
        icon={Flag}
        description={week.label}
        className={className}
        contentClassName="flex flex-col gap-3"
      >
        <p className="text-sm">
          No challenge picked yet. Pick one of four, like entering carbs at lunch or wearing the sensor
          all week. Done means +50 XP.
        </p>
        <Button asChild className="self-start">
          <Link to="/progress" search={{ tab: 'challenges' }}>
            Pick a challenge
            <ChevronRight />
          </Link>
        </Button>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="This week's challenge"
      icon={Flag}
      description={week.label}
      className={className}
      contentClassName="flex flex-col gap-3"
      action={<ChallengesLink>{week.canChange ? 'Change' : 'All'}</ChallengesLink>}
    >
      <div className="flex flex-col gap-0.5">
        <div className="font-semibold">{picked.name}</div>
        <div className="text-sm text-muted-foreground">{picked.text}</div>
      </div>
      <DayMarks progress={p} />
      <Progress
        value={Math.min(100, (p.done / p.target) * 100)}
        aria-label="Challenge progress"
        className={XP_PROGRESS}
      />
      <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="font-semibold tabular-nums">
          {Math.min(p.done, p.target)} of {p.target}
        </span>
        <span className="text-muted-foreground">
          {picked.unit} so far{p.complete ? '. Done, +50 XP.' : ''}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {week.canChange ? `You can change it until ${week.changeUntil}. ` : ''}Updates when you import.
      </p>
    </SectionCard>
  )
}
