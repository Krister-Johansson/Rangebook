import { getRouteApi } from '@tanstack/react-router'
import { CalendarDays, ChartSpline, Grid3x3, SlidersHorizontal } from 'lucide-react'

import { ChangesTimeline } from '#/components/changes/changes-timeline'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

import { DaysList } from './days-list'

export { DAYS_SHOWN } from './days-list'
import { TypicalDayCard } from './typical-day-card'
import { WeekMapCard } from './week-map-card'

const routeApi = getRouteApi('/trends')

type Tab = 'typical' | 'map' | 'days' | 'changes'

const TABS: { value: Tab; label: string; icon: typeof ChartSpline }[] = [
  { value: 'typical', label: 'Typical day', icon: ChartSpline },
  { value: 'map', label: 'Week map', icon: Grid3x3 },
  { value: 'days', label: 'Days', icon: CalendarDays },
  { value: 'changes', label: 'Changes', icon: SlidersHorizontal },
]

export function TrendsView() {
  const { tab } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: (prev) => ({ ...prev, tab: v as Tab }) })}
      className="mx-auto grid w-full max-w-4xl min-w-0 gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Trends</h1>
        <TabsList aria-label="Trend view" className="w-full sm:w-fit">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-1.5 sm:px-2">
              <t.icon className="hidden sm:block" aria-hidden="true" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="typical" className="min-w-0">
        <TypicalDayCard />
      </TabsContent>
      <TabsContent value="map" className="min-w-0">
        <WeekMapCard />
      </TabsContent>
      <TabsContent value="days" className="min-w-0">
        <DaysList />
      </TabsContent>
      <TabsContent value="changes" className="min-w-0">
        <ChangesTimeline />
      </TabsContent>
    </Tabs>
  )
}
