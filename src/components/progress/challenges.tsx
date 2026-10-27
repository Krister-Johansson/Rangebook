import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Flag, History, Info, Lock } from 'lucide-react'
import { toast } from 'sonner'

import { SectionCard } from '#/components/home/section-card'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import type { ChallengeId, GameState } from '#/lib/glucose/game'
import { CHALLENGES } from '#/lib/glucose/game'
import { pickChallenge } from '#/server/progress'
import { cn } from '#/lib/utils'

import { CHALLENGE_ICONS, DayMarks, challengeById } from './parts'

function usePickChallenge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (challengeId: ChallengeId) => pickChallenge({ data: { challengeId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['glucose'] }),
    onError: (err) =>
      toast.error(err instanceof Error && err.message ? err.message : 'That pick was not saved. Try again.'),
  })
}

export function XpChip({ children = '+50 XP' }: { children?: string }) {
  return (
    <Badge variant="outline" className="border-xp/40 text-xp">
      {children}
    </Badge>
  )
}

function PickCard({ progress }: { progress: GameState }) {
  const week = progress.thisWeek
  const pick = usePickChallenge()
  const locked = week.pick !== null && !week.canChange
  const current = pick.isPending ? pick.variables : week.pick

  const description = locked
    ? `${week.label}. The pick is locked until next Monday.`
    : week.canChange
      ? `${week.label}. You can change it until ${week.changeUntil}.`
      : `${week.label}. Once you pick, it stays until next Monday.`

  return (
    <SectionCard
      title={week.pick ? "This week's challenge" : "Pick this week's challenge"}
      icon={Flag}
      description={description}
      action={<XpChip />}
      contentClassName="flex flex-col gap-3"
    >
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={1}
        aria-label="Challenge this week"
        value={current ?? ''}
        disabled={locked || pick.isPending}
        onValueChange={(id) => {
          if (!id || id === week.pick) return
          pick.mutate(id as ChallengeId)
        }}
        className="w-full flex-col items-stretch gap-2"
      >
        {CHALLENGES.map((c) => {
          const p = week.progress.find((x) => x.id === c.id)!
          const Icon = CHALLENGE_ICONS[c.id]
          return (
            <ToggleGroupItem
              key={c.id}
              value={c.id}
              className="group/ch h-auto min-h-14 items-start justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal data-[state=on]:border-xp data-[state=on]:bg-xp-soft disabled:opacity-100"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground group-data-[state=on]/ch:border-xp"
              >
                <span className="hidden size-2 rounded-full bg-xp group-data-[state=on]/ch:block" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    {c.name}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{c.text}</span>
                </span>
                <DayMarks progress={p} small />
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {p.done} of {c.target}
              </span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      {locked ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock aria-hidden="true" className="size-3.5" />
          Picks can change until Wednesday. A new pick opens next Monday.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Done means +50 XP. If the week ends before it is done, the days you got still show here, and
        next week starts fresh. Progress updates when you import.
      </p>
    </SectionCard>
  )
}

function HistoryCard({ history }: { history: GameState['history'] }) {
  return (
    <SectionCard title="Earlier weeks" icon={History} description="Challenges you picked before.">
      {history.length ? (
        <ul className="flex flex-col">
          {history.map((h) => {
            const c = challengeById(h.id)
            const Icon = h.done ? Check : CHALLENGE_ICONS[h.id]
            return (
              <li key={h.weekStart} className="flex min-h-13 items-center gap-3 border-b py-2 last:border-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground',
                    h.done && 'bg-xp-soft text-xp',
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{h.label}</span>
                </span>
                <span className="text-xs tabular-nums">
                  {h.got} of {h.target} {c.unit}
                </span>
                {h.done ? <XpChip /> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Challenges you pick show up here after their week.</p>
      )}
    </SectionCard>
  )
}

export function ProgressChallenges({ progress }: { progress: GameState }) {
  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @[880px]:grid @[880px]:grid-cols-2 @[880px]:items-start">
        <PickCard progress={progress} />
        <div className="flex flex-col gap-4">
          <HistoryCard history={progress.history} />
          <Alert>
            <Info />
            <AlertTitle>Why these four</AlertTitle>
            <AlertDescription>
              They are about things you do: wearing the sensor, entering carbs and getting ready for
              clinic. None of them ask for a number or a time in range.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
