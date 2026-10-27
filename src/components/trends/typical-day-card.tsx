import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'

import { BandSwatch } from '#/components/glucose/band'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Switch } from '#/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import type { DayType } from '#/lib/glucose/analysis'
import { shortDate } from '#/lib/glucose/format'
import { profileQuery } from '#/lib/queries'

import { AgpChart } from './agp-chart'
import { findClusters, profileCaption } from './clusters'
import { Legend, LegendItem } from './legend'

const routeApi = getRouteApi('/trends')

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: 'all', label: 'All days' },
  { value: 'school', label: 'School days' },
  { value: 'weekend', label: 'Weekends' },
]

export function TypicalDayCard() {
  const { dayType } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { data } = useSuspenseQuery(profileQuery(dayType))
  const [showOuter, setShowOuter] = useState(true)

  const hours = data?.hours ?? []
  const hasData = hours.some((h) => h.n > 0)
  const clusters = hasData ? findClusters(hours) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Typical day</CardTitle>
        <CardDescription>
          All days laid on top of each other
          {data ? `, ${shortDate(data.from)} to ${shortDate(data.to)}` : ''}. mmol/L.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={dayType}
          aria-label="Which days"
          onValueChange={(v) => {
            if (v) navigate({ search: (prev) => ({ ...prev, dayType: v as DayType }), replace: true })
          }}
        >
          {DAY_TYPES.map((d) => (
            <ToggleGroupItem key={d.value} value={d.value}>
              {d.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {hasData ? (
          <>
            {clusters.length ? (
              <ul aria-label="Times that stand out" className="flex flex-wrap gap-1.5">
                {clusters.map((c) => (
                  <li key={c.label}>
                    <Badge variant="outline" className="gap-1.5 py-1">
                      <BandSwatch band={c.kind === 'low' ? 'low' : 'high'} />
                      {c.kind === 'low' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                      {c.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}

            <AgpChart hours={hours} clusters={clusters} showOuter={showOuter} />

            <p className="text-sm">{profileCaption(hours, dayType)}</p>

            <Legend>
              <LegendItem shape="line" swatch={{ background: 'var(--foreground)' }}>
                Median
              </LegendItem>
              <LegendItem swatch={{ background: 'var(--agp-iqr)' }}>Middle half (25 to 75%)</LegendItem>
              {showOuter ? (
                <LegendItem swatch={{ background: 'var(--agp-outer)' }}>Most readings (5 to 95%)</LegendItem>
              ) : null}
              <LegendItem
                swatch={{ background: 'var(--target-wash)', boxShadow: 'inset 0 0 0 1.5px var(--band-in)' }}
              >
                Target 3.9 to 10.0
              </LegendItem>
              {clusters.some((c) => c.kind === 'low') ? (
                <LegendItem swatch={{ background: 'var(--marker-low)', boxShadow: 'inset 0 0 0 1px var(--band-low)' }}>
                  Lows: more than 8% below 3.9
                </LegendItem>
              ) : null}
              {clusters.some((c) => c.kind === 'high') ? (
                <LegendItem
                  swatch={{ background: 'var(--marker-high)', boxShadow: 'inset 0 0 0 1px var(--band-high)' }}
                >
                  Highs: 55% or more above 10.0
                </LegendItem>
              ) : null}
            </Legend>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            There are no readings for these days yet.
          </p>
        )}

        <Separator />
        <div className="flex items-start gap-3">
          <Switch id="agp-outer" checked={showOuter} onCheckedChange={setShowOuter} className="mt-0.5" />
          <div className="grid gap-1">
            <Label htmlFor="agp-outer">Show most readings (5 to 95%)</Label>
            <p className="text-xs text-muted-foreground">
              The wider band shows how far readings spread on unusual days.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
