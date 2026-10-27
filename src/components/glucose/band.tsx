import { ArrowDown, ArrowUp, Utensils } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import type { Band } from '#/lib/glucose/core'
import { cn } from '#/lib/utils'

export const bandVar = (band: Band) => `var(--band-${band})`

/** Color plus optional stripes. Always place it next to a text label. */
export function BandSwatch({
  band,
  shape = 'square',
  className,
}: {
  band: Band
  shape?: 'square' | 'line'
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0',
        `band-fill-${band}`,
        shape === 'line' ? 'h-0.5 w-3 rounded-full' : 'size-2.5 rounded-[3px]',
        className,
      )}
      style={{ backgroundColor: bandVar(band) }}
    />
  )
}

export function KindBadge({ kind }: { kind: 'low' | 'high' | 'routine' }) {
  if (kind === 'routine') {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Utensils className="size-3" />
        Routine
      </Badge>
    )
  }
  const Icon = kind === 'low' ? ArrowDown : ArrowUp
  return (
    <Badge variant="outline" className="gap-1.5">
      <BandSwatch band={kind === 'low' ? 'low' : 'high'} />
      <Icon className="size-3" />
      {kind === 'low' ? 'Lows' : 'Highs'}
    </Badge>
  )
}

/**
 * SVG patterns for the optional stripes on the low bands. CSS background
 * images do not apply to SVG shapes, so charts get these fills instead
 * (see the .stripes rules in styles.css).
 */
export function BandPatternDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {(['vlow', 'low'] as const).map((band) => (
          <pattern
            key={band}
            id={`band-stripes-${band}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" style={{ fill: bandVar(band) }} />
            <rect width="2" height="6" style={{ fill: 'var(--hatch-ink)' }} />
          </pattern>
        ))}
      </defs>
    </svg>
  )
}
