import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

/** Header for a page below a tab: back link, title, optional action and intro. */
export function BackHead({
  back,
  backTo,
  title,
  sub,
  action,
}: {
  back: string
  backTo: LinkProps
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Link
        {...backTo}
        className="-ml-1 inline-flex min-h-9 w-fit items-center gap-1 rounded-md px-1 text-sm font-medium text-muted-foreground no-underline hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {back}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
        {action ?? null}
      </div>
      {sub ? <div className="max-w-[62ch] text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

/** A row in a list that opens another page. */
export function NavRow({
  to,
  icon,
  title,
  sub,
  right,
  className,
}: {
  to: LinkProps
  icon?: ReactNode
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <Link
      {...to}
      className={cn(
        'flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 text-foreground no-underline transition-colors duration-(--dur-press) hover:bg-accent active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      {icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold leading-snug">{title}</span>
        {sub ? <span className="text-sm text-muted-foreground">{sub}</span> : null}
      </span>
      {right ?? null}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
