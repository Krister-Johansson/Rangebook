import type { CSSProperties, ReactNode } from 'react'

import { cn } from '#/lib/utils'

export function Legend({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul
      aria-label="Legend"
      className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}
    >
      {children}
    </ul>
  )
}

export function LegendItem({
  children,
  swatch,
  shape = 'square',
  className,
}: {
  children: ReactNode
  swatch: CSSProperties
  shape?: 'square' | 'line'
  className?: string
}) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block shrink-0',
          shape === 'line' ? 'h-[3px] w-4 rounded-full' : 'size-3 rounded-[3px]',
          className,
        )}
        style={swatch}
      />
      {children}
    </li>
  )
}
