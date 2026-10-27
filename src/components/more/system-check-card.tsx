import { Link } from '@tanstack/react-router'
import {
  Activity,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  Cpu,
  Gauge,
  Info,
  Pause,
  Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { SectionCard } from '#/components/home/section-card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import type { SystemItem } from '#/lib/glucose/analysis'
import { cn } from '#/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  wear: Activity,
  carbs: Utensils,
  auto: Cpu,
  stops: Pause,
  controliq: CircleDashed,
}

function statusBadge(item: SystemItem) {
  if (item.status === 'unknown') {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <CircleDashed className="size-3" />
        Not known
      </Badge>
    )
  }
  const ok = item.status === 'ok'
  const text =
    item.id === 'wear' ? (ok ? 'Enough data' : 'Less data') : ok ? 'Looks fine' : 'Worth a look'
  const Icon = ok ? CircleCheck : Info
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className={cn('size-3', ok && 'text-win')} />
      {text}
    </Badge>
  )
}

export function SystemCheckCard({
  items,
  period,
  compact = false,
  className,
}: {
  items: SystemItem[]
  /** Plain words for the period, e.g. "Last 7 days". */
  period: string
  compact?: boolean
  className?: string
}) {
  const rows = compact ? items.filter((i) => i.id !== 'auto' && i.id !== 'controliq') : items
  return (
    <SectionCard
      title="System check"
      icon={Gauge}
      description={`${period}. Things that help the numbers make sense.`}
      action={
        compact ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/more/system">
              All
              <ChevronRight />
            </Link>
          </Button>
        ) : null
      }
      id={compact ? undefined : 'system'}
      className={className}
    >
      <ul className="flex flex-col gap-3.5">
        {rows.map((item) => {
          const Icon = ICONS[item.id] ?? Info
          const wear = item.id === 'wear' ? Number.parseFloat(item.value) : Number.NaN
          return (
            <li key={item.id} className="flex items-start gap-2.5">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span
                    className={cn(
                      'text-right text-sm font-bold tabular-nums',
                      item.status === 'unknown' && 'font-medium text-muted-foreground',
                    )}
                  >
                    {item.value}
                  </span>
                </div>
                {Number.isFinite(wear) ? (
                  <Progress value={Math.min(100, wear)} aria-label={`${item.label} ${item.value}`} />
                ) : null}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="text-xs text-muted-foreground">{item.detail}</span>
                  {statusBadge(item)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
