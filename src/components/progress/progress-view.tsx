import { useSuspenseQuery } from '@tanstack/react-query'

import { EmptyState } from '#/components/glucose/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { progressQuery } from '#/lib/queries'

import { ProgressBadges } from './badges'
import { ProgressBests } from './bests'
import { ProgressChallenges } from './challenges'
import { ProgressOverview } from './overview'

export const PROGRESS_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'badges', label: 'Badges' },
  { value: 'challenges', label: 'Challenges' },
  { value: 'bests', label: 'Bests' },
] as const

export type ProgressTab = (typeof PROGRESS_TABS)[number]['value']

export function ProgressView({ tab, onTab }: { tab: ProgressTab; onTab: (tab: ProgressTab) => void }) {
  const { data: progress } = useSuspenseQuery(progressQuery)
  if (!progress) return <EmptyState />

  return (
    <Tabs value={tab} onValueChange={(v) => onTab(v as ProgressTab)} className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <TabsList aria-label="Progress view" className="w-full sm:w-fit">
          {PROGRESS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="min-h-8 flex-1 px-1.5 text-[13px] sm:px-3 sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="overview">
        <ProgressOverview progress={progress} />
      </TabsContent>
      <TabsContent value="badges">
        <ProgressBadges progress={progress} />
      </TabsContent>
      <TabsContent value="challenges">
        <ProgressChallenges progress={progress} />
      </TabsContent>
      <TabsContent value="bests">
        <ProgressBests progress={progress} />
      </TabsContent>
    </Tabs>
  )
}
