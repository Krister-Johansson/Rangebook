import { useSuspenseQuery } from '@tanstack/react-query'
import { Award, ChevronDown, CircleCheck, History, Zap } from 'lucide-react'
import { useState } from 'react'

import { CompanionCard } from '#/components/companion/companion-card'
import { SectionCard } from '#/components/home/section-card'
import { Card } from '#/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import type { Win } from '#/lib/glucose/analysis'
import type { GameState } from '#/lib/glucose/game'
import { XP_RULES, levelStart } from '#/lib/glucose/game'
import { homeQuery, prefsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

import { GoalCard } from './goal-card'
import { XP_WEEKS_SHOWN, XpWeekChart } from './xp-week-chart'

function XpRules() {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="gap-0 py-0">
        <h2 className="text-base leading-tight font-semibold">
          <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:px-6">
            <span className="flex items-center gap-2">
              <Zap aria-hidden="true" className="size-4 text-muted-foreground" />
              How XP works
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 text-muted-foreground transition-transform duration-(--dur-pop) ease-out', open && 'rotate-180')}
            />
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent className="flex flex-col gap-4 px-4 pb-5 duration-(--dur-pop) ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 sm:px-6">
          <table className="w-full text-sm">
            <caption className="sr-only">XP for each thing you do</caption>
            <tbody>
              {XP_RULES.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <th scope="row" className="py-2 text-left font-normal">
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.note}</div>
                  </th>
                  <td className="py-2 text-right font-semibold tabular-nums">+{r.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>XP only goes up. Levels never drop.</li>
            <li>Nothing resets. Counts are "5 of 7 days", never a streak.</li>
            <li>
              Everything comes from your imported data, so it updates when you import. Importing the same
              days again does not count twice.
            </li>
            <li>XP is for things you do. It never depends on your readings.</li>
          </ul>
          <ol aria-label="XP needed for each level" className="flex flex-wrap gap-1.5">
            {Array.from({ length: 9 }, (_, i) => i + 2).map((lv) => (
              <li key={lv} className="flex min-w-14 flex-col rounded-lg bg-muted px-2 py-1 text-center">
                <span className="text-xs font-semibold">Level {lv}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{levelStart(lv)} XP</span>
              </li>
            ))}
            <li className="flex min-w-14 flex-col rounded-lg bg-muted px-2 py-1 text-center">
              <span className="text-xs font-semibold">Level 11+</span>
              <span className="text-xs text-muted-foreground">+550 each</span>
            </li>
          </ol>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function WinsCard({ wins, description }: { wins: Win[]; description?: string }) {
  return (
    <SectionCard title="Wins this week" icon={Award} description={description}>
      {wins.length ? (
        <ul className="flex flex-col gap-3">
          {wins.map((w) => (
            <li key={w.id} className="flex items-start gap-2.5">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-win" />
              <div>
                <div className="text-sm font-medium">{w.title}</div>
                <div className="text-xs text-muted-foreground">{w.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Wins show up here when this week has something to point out.
        </p>
      )}
    </SectionCard>
  )
}

export function ProgressOverview({ progress }: { progress: GameState }) {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data: home } = useSuspenseQuery(homeQuery)
  const recent = progress.weeks.filter((w) => !w.current).slice(-4)
  const avg = recent.length
    ? Math.round(recent.reduce((n, w) => n + w.sensor + w.carbs, 0) / recent.length)
    : null
  const shown = Math.min(XP_WEEKS_SHOWN, progress.weeks.length)

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @[880px]:grid @[880px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @[880px]:items-start">
        <div className="flex flex-col gap-4">
          <CompanionCard progress={progress} pet={prefs.pet} large />
          <SectionCard
            title="XP per week"
            icon={History}
            description={`Last ${shown} week${shown === 1 ? '' : 's'}, Monday to Sunday. This week is so far.`}
            contentClassName="flex flex-col gap-3"
          >
            <XpWeekChart weeks={progress.weeks} />
            {avg !== null ? (
              <p className="text-sm text-muted-foreground">
                Lately about {avg} XP a week from sensor days and carb entries, before challenges and
                badges.
              </p>
            ) : null}
          </SectionCard>
          <XpRules />
        </div>
        <div className="flex flex-col gap-4">
          <WinsCard wins={home?.wins ?? []} description={home ? `This week, ${home.thisWeek.label}` : undefined} />
          <GoalCard goals={home?.goals ?? []} />
        </div>
      </div>
    </div>
  )
}
