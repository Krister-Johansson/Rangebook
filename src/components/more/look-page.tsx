import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ClientOnly } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { Check, Monitor, Moon, Palette, Sprout, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CompanionSvg, PET_COLORS, petColor } from '#/components/companion/companion-svg'
import type { PetMood } from '#/components/companion/companion-svg'
import { SectionCard } from '#/components/home/section-card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { STAGES } from '#/lib/glucose/game'
import { prefsQuery, progressQuery } from '#/lib/queries'
import { setStripes, setTheme, uiStore } from '#/lib/ui-store'
import type { Theme } from '#/lib/ui-store'
import { cn } from '#/lib/utils'

import { BackHead } from './page-head'
import { useSetPrefs } from './prefs'
import { SwitchRow } from './switch-row'

const NAME_MAX = 24

const MOODS: { id: PetMood; label: string }[] = [
  { id: 'happy', label: 'Happy' },
  { id: 'curious', label: 'Curious' },
  { id: 'celebrating', label: 'Party' },
  { id: 'sleepy', label: 'Sleepy' },
]

/** "Levels 1 and 2" -> "L1 to 2", "Level 10 and up" -> "L10 and up". */
function shortLevels(levels: string) {
  return levels.replace(/^Levels? /, 'L').replace(' and up', '+').replace(' and ', ' to ')
}

function CompanionCardEditor() {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data: progress } = useQuery(progressQuery)
  const setPrefs = useSetPrefs()
  const [name, setName] = useState(prefs.pet.name)
  const [mood, setMood] = useState<PetMood>(progress?.mood ?? 'happy')
  useEffect(() => setName(prefs.pet.name), [prefs.pet.name])

  const stage = Math.min(5, Math.max(1, progress?.stage ?? 1))
  const shown = name.trim() || 'Pip'
  const color = prefs.pet.color

  const saveName = () => {
    const next = name.trim().slice(0, NAME_MAX)
    if (next === prefs.pet.name) return
    setPrefs.mutate({ pet: { ...prefs.pet, name: next } })
  }

  return (
    <SectionCard
      title="Your companion"
      icon={Sprout}
      description="It grows as you level up. It never reacts to your readings."
      contentClassName="flex flex-col gap-5"
    >
      <div
        className="grid h-36 place-items-center rounded-2xl"
        style={{ background: `color-mix(in oklab, ${petColor(color).body} 20%, var(--card))` }}
      >
        <CompanionSvg stage={stage} mood={mood} color={color} size={112} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pet-name">Name</Label>
        <Input
          id="pet-name"
          value={name}
          maxLength={NAME_MAX}
          placeholder="Pip"
          autoComplete="off"
          aria-describedby="pet-name-hint"
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              saveName()
            }
          }}
        />
        <p id="pet-name-hint" className="text-xs text-muted-foreground">
          Up to {NAME_MAX} characters. Saved when you leave the field.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="pet-color-label" className="text-sm font-medium">
          Color
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby="pet-color-label"
          value={color}
          onValueChange={(v) => {
            if (v) setPrefs.mutate({ pet: { name: name.trim().slice(0, NAME_MAX), color: v } })
          }}
          className="gap-2"
        >
          {PET_COLORS.map((c) => (
            <ToggleGroupItem
              key={c.id}
              value={c.id}
              aria-label={c.label}
              title={c.label}
              className="size-10 flex-none rounded-full! border-2 border-transparent p-0 data-[state=on]:border-foreground"
              style={{ background: c.body }}
            >
              {color === c.id ? (
                <Check aria-hidden="true" className="size-4 text-[oklch(0.25_0.02_260)]" />
              ) : null}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="pet-mood-label" className="text-sm font-medium">
          Preview a mood
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby="pet-mood-label"
          value={mood}
          onValueChange={(v) => {
            if (v) setMood(v as PetMood)
          }}
          className="flex-wrap"
        >
          {MOODS.map((m) => (
            <ToggleGroupItem key={m.id} value={m.id}>
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          This is only a preview. {shown}'s mood follows what happened: party after a new badge or a
          finished challenge, sleepy after 8 days with no new data.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Growth stages</span>
        <ol className="grid grid-cols-5 gap-1">
          {STAGES.map((s) => (
            <li
              key={s.n}
              aria-current={s.n === stage ? 'step' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg border border-transparent px-0.5 py-1.5 text-center',
                s.n === stage && 'border-border bg-muted',
              )}
            >
              <CompanionSvg stage={s.n} mood="happy" color={color} size={40} still />
              <span className="text-xs font-semibold">{s.name}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                <span aria-hidden="true">{shortLevels(s.levels)}</span>
                <span className="sr-only">{s.levels}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </SectionCard>
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

export function LookPage() {
  return (
    <div className="@container mx-auto flex w-full max-w-4xl flex-col gap-4">
      <BackHead back="More" backTo={{ to: '/more' }} title="Look" sub="Make it yours." />
      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        <CompanionCardEditor />
        <SectionCard
          title="Theme"
          icon={Palette}
          description="Saved on this device."
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
      </div>
    </div>
  )
}
