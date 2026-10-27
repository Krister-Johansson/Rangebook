import { FileArchive, User, Users } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import type { SettingsChange } from '#/lib/glucose/changes'
import { cn } from '#/lib/utils'

/** Who wrote a note: the teen or a parent. */
export function AuthorChip({ author, className }: { author: 'you' | 'parent'; className?: string }) {
  const Icon = author === 'parent' ? Users : User
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 font-medium', author === 'parent' ? 'border-parent/50 text-parent' : '', className)}
    >
      <Icon className="size-3" aria-hidden="true" />
      {author === 'parent' ? 'Parent' : 'You'}
    </Badge>
  )
}

export function ExportChip() {
  return (
    <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
      <FileArchive className="size-3" aria-hidden="true" />
      Found in export
    </Badge>
  )
}

/** "Basal and carb ratio" */
export function changeSummary(rows: SettingsChange['rows']) {
  const names = rows.map((r) => (r.setting === 'Basal' ? 'basal' : 'carb ratio'))
  const text = names.join(' and ')
  return text ? `${text[0].toUpperCase()}${text.slice(1)} changed` : 'Settings changed'
}

/**
 * The record of what was set before and after. This is the only place in the
 * app where settings values appear; they are a record, never advice.
 */
export function WhatChangedTable({ rows, compact }: { rows: SettingsChange['rows']; compact?: boolean }) {
  return (
    <table className={cn('w-full border-collapse text-left', compact ? 'text-xs' : 'text-sm')}>
      <caption className="sr-only">What changed</caption>
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="py-1 pr-2 font-medium">
            Setting
          </th>
          <th scope="col" className="py-1 pr-2 font-medium">
            Before
          </th>
          <th scope="col" className="py-1 font-medium">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.setting} className="border-t align-top">
            <th scope="row" className="py-1.5 pr-2 font-semibold">
              {r.setting}
            </th>
            <td className="py-1.5 pr-2">{r.before}</td>
            <td className="py-1.5">{r.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
