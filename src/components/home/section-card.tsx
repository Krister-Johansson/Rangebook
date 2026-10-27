import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { cn } from '#/lib/utils'

/** shadcn Card with the design's header layout: icon, title, description, action. */
export function SectionCard({
  title,
  icon: Icon,
  description,
  action,
  children,
  className,
  contentClassName,
  id,
}: {
  title: string
  icon?: LucideIcon
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  id?: string
}) {
  return (
    <Card id={id} className={cn('gap-4 py-5', className)}>
      <CardHeader className="gap-1.5 px-4 sm:px-6">
        <CardTitle>
          <h2 className="flex items-center gap-2 text-base leading-tight">
            {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
            {title}
          </h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn('px-4 sm:px-6', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
