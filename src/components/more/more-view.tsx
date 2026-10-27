import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ClientOnly, Link } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { Database, Monitor, Moon, Palette, Sun, Upload, Users } from 'lucide-react'

import { SectionCard } from '#/components/home/section-card'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { daysBetween } from '#/lib/glucose/core'
import { rangeLabel, shortDate } from '#/lib/glucose/format'
import { dataRangeQuery, overviewQuery, prefsQuery, systemCheckQuery } from '#/lib/queries'
import { setStripes, setTheme, uiStore } from '#/lib/ui-store'
import type { Theme } from '#/lib/ui-store'

import { SHARE_ITEMS, useSetPrefs } from './prefs'
import { SystemCheckCard } from './system-check-card'

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        {description ? (
          <p id={`${id}-desc`} className="text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
    </div>
  )
}

function SharingCard() {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const setPrefs = useSetPrefs()
  return (
    <SectionCard
      title="What your parent sees"
      icon={Users}
      description="You decide, and you can change it any time. Agree together on when your parent will check and when they will ask first."
      contentClassName="flex flex-col gap-4"
    >
      {SHARE_ITEMS.map((s) => (
        <SwitchRow
          key={s.id}
          id={`share-${s.id}`}
          label={s.label}
          description={s.description}
          checked={!!prefs.sharing[s.id]}
          onCheckedChange={(v) => setPrefs.mutate({ sharing: { ...prefs.sharing, [s.id]: v } })}
        />
      ))}
    </SectionCard>
  )
}

function SystemCard() {
  const { data } = useSuspenseQuery(systemCheckQuery(14))
  if (!data) {
    return (
      <SectionCard title="System check" id="system">
        <p className="text-sm text-muted-foreground">Import data to see the system check.</p>
      </SectionCard>
    )
  }
  return (
    <SystemCheckCard
      items={data.items}
      period={`Last ${daysBetween(data.from, data.to) + 1} days, ${rangeLabel(data.from, data.to)}`}
    />
  )
}

// Theme and stripes live in the browser, so they render only after mount.
function LookControls() {
  const theme = useStore(uiStore, (s) => s.theme)
  const stripes = useStore(uiStore, (s) => s.stripes)
  return (
    <>
      <div className="flex flex-col gap-2">
        <span id="theme-label" className="text-sm font-medium">
          Theme
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby="theme-label"
          value={theme}
          onValueChange={(v) => {
            if (v) setTheme(v as Theme)
          }}
        >
          <ToggleGroupItem value="light">
            <Sun />
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark">
            <Moon />
            Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="system">
            <Monitor />
            System
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <SwitchRow
        id="stripes"
        label="Stripes on low ranges"
        description="Adds a pattern to low and very low, for printing and for color-blind viewers."
        checked={stripes}
        onCheckedChange={setStripes}
      />
    </>
  )
}

function LookCard() {
  return (
    <SectionCard
      title="Look"
      icon={Palette}
      description="Make it yours. These settings are saved on this device."
      contentClassName="flex flex-col gap-4"
    >
      <ClientOnly
        fallback={
          <>
            <Skeleton className="h-14 w-60" />
            <Skeleton className="h-10 w-full" />
          </>
        }
      >
        <LookControls />
      </ClientOnly>
    </SectionCard>
  )
}

function DataCard() {
  const { data: range } = useSuspenseQuery(dataRangeQuery)
  const { data: overview } = useQuery(overviewQuery)

  let description = 'No data imported yet.'
  if (range) {
    const days = daysBetween(range.firstDay, range.lastDay) + 1
    description = `Last reading ${shortDate(range.lastDay)} at ${range.lastTs.slice(11, 16)}. Stored data covers ${days} day${days === 1 ? '' : 's'}, ${shortDate(range.firstDay)} to ${shortDate(range.lastDay)}.`
  }
  const readings = overview?.cgm.rows

  return (
    <SectionCard
      title="Data"
      icon={Database}
      description={description}
      contentClassName="flex flex-col items-start gap-3"
    >
      {range && readings ? (
        <p className="text-sm text-muted-foreground">
          {readings.toLocaleString('en-US')} sensor readings stored.
        </p>
      ) : null}
      <Button variant="outline" asChild>
        <Link to="/import">
          <Upload />
          Import data
        </Link>
      </Button>
    </SectionCard>
  )
}

export function MoreView() {
  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="text-[22px] leading-tight font-bold tracking-tight">More</h1>
      <div className="grid grid-cols-1 items-start gap-4 @[820px]:grid-cols-2">
        <SharingCard />
        <SystemCard />
        <LookCard />
        <DataCard />
      </div>
      <p className="max-w-prose text-xs text-muted-foreground">
        Rangebook is not a medical device. It shows patterns in exported data and questions to bring to
        the care team. Do not use it to decide doses or change pump settings on your own.
      </p>
    </div>
  )
}
