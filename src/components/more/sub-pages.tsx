import { useSuspenseQuery } from '@tanstack/react-query'

import { daysBetween } from '#/lib/glucose/core'
import { rangeLabel } from '#/lib/glucose/format'
import { prefsQuery, systemCheckQuery } from '#/lib/queries'
import { Card, CardContent } from '#/components/ui/card'

import { BackHead } from './page-head'
import { SHARE_ITEMS, useSetPrefs } from './prefs'
import { SwitchRow } from './switch-row'
import { SystemCheckCard } from './system-check-card'

export function SharingPage() {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const setPrefs = useSetPrefs()
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <BackHead
        back="More"
        backTo={{ to: '/more' }}
        title="What your parent sees"
        sub="You decide, and you can change it any time. Agree together on when your parent will check and when they will ask first."
      />
      <Card className="py-5">
        <CardContent className="flex flex-col gap-4 px-4 sm:px-6">
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
        </CardContent>
      </Card>
      <p className="max-w-prose text-sm text-muted-foreground">
        Your parent can add life log items and settings changes. Each one shows who added it.
      </p>
    </div>
  )
}

export function SystemPage() {
  const { data } = useSuspenseQuery(systemCheckQuery(14))
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <BackHead
        back="More"
        backTo={{ to: '/more' }}
        title="System check"
        sub="Things that help the numbers make sense."
      />
      {data ? (
        <SystemCheckCard
          items={data.items}
          period={`Last ${daysBetween(data.from, data.to) + 1 === 1 ? 'day' : `${daysBetween(data.from, data.to) + 1} days`}, ${rangeLabel(data.from, data.to)}`}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Import data to see the system check.</p>
      )}
    </div>
  )
}
