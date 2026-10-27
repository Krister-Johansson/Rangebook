import { getRouteApi } from '@tanstack/react-router'
import { ChartSpline, Grid3x3 } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

import { TypicalDayCard } from './typical-day-card'
import { WeekMapCard } from './week-map-card'

const routeApi = getRouteApi('/trends')

export function TrendsView() {
  const { tab } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: (prev) => ({ ...prev, tab: v as 'typical' | 'map' }) })}
      className="mx-auto grid w-full max-w-4xl min-w-0 gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Trends</h1>
        <TabsList aria-label="Trend view">
          <TabsTrigger value="typical">
            <ChartSpline />
            Typical day
          </TabsTrigger>
          <TabsTrigger value="map">
            <Grid3x3 />
            Week map
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="typical" className="min-w-0">
        <TypicalDayCard />
      </TabsContent>
      <TabsContent value="map" className="min-w-0">
        <WeekMapCard />
      </TabsContent>
    </Tabs>
  )
}
