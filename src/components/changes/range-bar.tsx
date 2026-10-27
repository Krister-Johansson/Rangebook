import type { Band } from '#/lib/glucose/core'
import { cn } from '#/lib/utils'

// Lows on the left so they are read first.
const ORDER: Band[] = ['vlow', 'low', 'in', 'high', 'vhigh']
const WORD: Record<Band, string> = {
  vlow: 'very low',
  low: 'low',
  in: 'in range',
  high: 'high',
  vhigh: 'very high',
}

/** The five ranges as one stacked bar. */
export function RangeBar({ pct, label, className }: { pct: Record<Band, number>; label: string; className?: string }) {
  const text = ORDER.map((b) => `${pct[b].toFixed(1)}% ${WORD[b]}`).join(', ')
  return (
    <div
      role="img"
      aria-label={`${label}: ${text}`}
      className={cn('flex h-[18px] w-full gap-0.5 overflow-hidden rounded-sm', className)}
    >
      {ORDER.filter((b) => pct[b] > 0).map((b) => (
        <span
          key={b}
          className={cn('flex h-full min-w-[3px] basis-0 items-center justify-center text-[10px] font-bold', `band-fill-${b}`)}
          style={{
            flexGrow: pct[b],
            backgroundColor: `var(--band-${b})`,
            color: b === 'in' ? 'var(--band-in-ink)' : undefined,
          }}
        >
          {b === 'in' && pct[b] >= 12 ? `${Math.round(pct[b])}%` : null}
        </span>
      ))}
    </div>
  )
}
