import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

import { useSetPrefs } from '#/components/more/prefs'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { notNormalDays } from '#/lib/glucose/lifelog'
import { lifeLogQuery, prefsQuery } from '#/lib/queries'

/** The "Leave out not-normal days" switch, bound to prefs.excludeNotNormal. */
export function ExcludeSwitch({ id = 'exclude-not-normal' }: { id?: string }) {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data: log } = useQuery(lifeLogQuery)
  const setPrefs = useSetPrefs()
  const tagged = log ? notNormalDays(log).size : null

  let description =
    'Days you tag as sick, vacation, period, school break or other. Patterns and comparisons skip them while this is on.'
  if (tagged === 0) {
    description = 'No days are tagged in your life log yet. Tag a day as sick or vacation, for example, and it can be left out.'
  } else if (tagged !== null) {
    description = `${tagged} tagged ${tagged === 1 ? 'day' : 'days'} in your life log. Patterns and comparisons skip them while this is on.`
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={id} className="leading-snug">
          Leave out not-normal days from patterns and comparisons
        </Label>
        <p id={`${id}-desc`} className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={prefs.excludeNotNormal}
        onCheckedChange={(v) => setPrefs.mutate({ excludeNotNormal: v })}
        aria-describedby={`${id}-desc`}
        disabled={setPrefs.isPending}
      />
    </div>
  )
}
