import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil, Target } from 'lucide-react'
import { Suspense, useState } from 'react'

import { useSetPrefs } from '#/components/more/prefs'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { Skeleton } from '#/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import type { Goal } from '#/lib/glucose/analysis'
import { prefsQuery } from '#/lib/queries'

import { SectionCard } from './section-card'

function GoalCardInner({ goals, className }: { goals: Goal[]; className?: string }) {
  const [editing, setEditing] = useState(false)
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const setPrefs = useSetPrefs()

  const goal = goals.find((g) => g.id === prefs.goalId) ?? goals[0]
  const done = goal ? Math.min(goal.target, goal.done) : 0
  const value = goal && goal.target > 0 ? (done / goal.target) * 100 : 0

  return (
    <SectionCard
      title="Your goal"
      icon={Target}
      description="You pick it, and you can change it any time."
      className={className}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(!editing)}
          aria-expanded={editing}
          disabled={!goal}
        >
          <Pencil />
          {editing ? 'Done' : 'Change'}
        </Button>
      }
    >
      {!goal ? (
        <p className="text-sm text-muted-foreground">There are no goals to pick from yet.</p>
      ) : editing ? (
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={1}
          aria-label="Choose a goal"
          value={goal.id}
          onValueChange={(id) => {
            if (!id) return
            setPrefs.mutate({ goalId: id })
            setEditing(false)
          }}
          className="w-full flex-col items-stretch gap-1.5"
        >
          {goals.map((g) => (
            <ToggleGroupItem
              key={g.id}
              value={g.id}
              className="group/goal h-auto min-h-11 justify-start gap-2.5 rounded-lg px-3 py-2 text-left whitespace-normal data-[state=on]:border-foreground"
            >
              <span
                aria-hidden="true"
                className="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground"
              >
                <span className="hidden size-2 rounded-full bg-foreground group-data-[state=on]/goal:block" />
              </span>
              {g.text}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="font-semibold">{goal.text}</div>
          <Progress value={value} aria-label="Goal progress" />
          <div className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-semibold">
              {done} of {goal.target}
            </span>
            <span className="text-muted-foreground">{goal.unit} in the last 7 days</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Each day counts on its own. A skipped day does not reset anything.
          </p>
        </div>
      )}
    </SectionCard>
  )
}

export function GoalCard({ goals, className }: { goals: Goal[]; className?: string }) {
  return (
    <Suspense
      fallback={
        <SectionCard title="Your goal" icon={Target} className={className}>
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </SectionCard>
      }
    >
      <GoalCardInner goals={goals} className={className} />
    </Suspense>
  )
}
