import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, GitCompareArrows, Plus, SlidersHorizontal, StickyNote } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { shortDate } from '#/lib/glucose/format'
import { settingsTimelineQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { TimelineItem } from '#/server/changes'

import { AddChangeSheet } from './add-change-sheet'
import { AuthorChip, ExportChip, WhatChangedTable, changeSummary } from './what-changed'

export function ChangesTimeline() {
  const { data: items } = useSuspenseQuery(settingsTimelineQuery)
  const [adding, setAdding] = useState(false)

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Settings changes
          </CardTitle>
          <CardDescription>
            Found in the pump export, or added by hand. Open one to compare the days before and after.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <ol className="relative grid gap-3 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-border" aria-label="Settings changes, newest first">
              {items.map((it) => (
                <li key={it.id} className="relative pl-7">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-3 left-0.5 size-[11px] rounded-full border-2 border-background',
                      it.source === 'export' ? 'bg-foreground' : 'bg-parent',
                    )}
                  />
                  <TimelineEntry item={it} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No settings changes found yet. Use Add to note a change from a clinic visit or a call.
            </p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        The export has no settings file. Changes are found from long basal segments and the carb ratio on each bolus,
        so times can be a few minutes off.
      </p>
      <AddChangeSheet open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function When({ item }: { item: TimelineItem }) {
  return (
    <span className="font-semibold">
      {shortDate(item.day)}
      {item.time ? <span className="font-normal text-muted-foreground">, {item.time}</span> : null}
    </span>
  )
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  if (item.source === 'logged') {
    return (
      <div className="grid gap-1.5 rounded-lg border border-dashed px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <When item={item} />
          {item.note ? <AuthorChip author={item.note.author} /> : null}
          <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
            <StickyNote className="size-3" aria-hidden="true" />
            Added by hand
          </Badge>
        </div>
        {item.note ? <p className="text-sm">{item.note.text}</p> : null}
      </div>
    )
  }

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <When item={item} />
        <ExportChip />
        {item.canCompare ? (
          <Badge variant="secondary" className="gap-1 font-medium">
            <GitCompareArrows className="size-3" aria-hidden="true" />
            Compare
          </Badge>
        ) : null}
      </div>
      <p className="text-sm">{changeSummary(item.rows)}</p>
      {!item.canCompare ? (
        <div className="grid gap-2">
          <WhatChangedTable rows={item.rows} compact />
          {item.lastedDays !== null ? (
            <p className="text-xs text-muted-foreground">
              Lasted {item.lastedDays} {item.lastedDays === 1 ? 'day' : 'days'} before the next change, too short to
              compare. A compare needs at least 7 days on each side.
            </p>
          ) : null}
        </div>
      ) : null}
      {item.note ? (
        <div className="flex flex-wrap items-start gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-sm">
          <AuthorChip author={item.note.author} />
          <span className="min-w-0 flex-1">{item.note.text}</span>
        </div>
      ) : null}
    </>
  )

  if (!item.canCompare) {
    return <div className="grid gap-1.5 rounded-lg border px-3 py-2.5">{body}</div>
  }
  return (
    <Link
      to="/trends/changes/$changeId"
      params={{ changeId: item.id }}
      search={{ days: 14 }}
      className="flex items-center gap-2 rounded-lg border px-3 py-2.5 no-underline outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="grid min-w-0 flex-1 gap-1.5">{body}</div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Compare before and after</span>
    </Link>
  )
}
