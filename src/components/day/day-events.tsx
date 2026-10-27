import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { DayDetail } from '#/lib/glucose/analysis'
import { clock } from '#/lib/glucose/format'

import { stopSummary } from './day-chart'

interface Row {
  t: number
  what: string
  units: number | null
}

const WHAT = {
  carb: (g: number) => `Bolus with ${g} g carbs`,
  manual: () => 'Bolus, no carbs entered',
  auto: () => 'Automatic correction (estimated)',
}

/** The same events as the lanes, as a list that does not depend on the chart. */
export function DayEvents({ day }: { day: DayDetail }) {
  const rows: Row[] = [
    ...day.boluses.map((b) => ({ t: b.t, what: WHAT[b.kind](b.carbs), units: b.units })),
    ...day.alarms.map((a) => ({ t: a.t, what: a.label, units: null })),
    ...stopSummary(day.basal).map((s) => ({ t: s.t, what: s.label, units: null })),
  ].sort((a, b) => a.t - b.t)

  const carbEntries = day.boluses.filter((b) => b.carbs > 0)
  const carbs = carbEntries.reduce((n, b) => n + b.carbs, 0)
  const total = day.boluses.reduce((n, b) => n + b.units, 0)

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No boluses, alarms or pump stops this day.</p>
  }

  return (
    <div className="grid gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Time</TableHead>
            <TableHead>What</TableHead>
            <TableHead className="text-right">Insulin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.t}-${i}`}>
              <TableCell className="tabular-nums">{clock(r.t)}</TableCell>
              <TableCell className="whitespace-normal">{r.what}</TableCell>
              <TableCell className="text-right tabular-nums">{r.units != null ? `${r.units.toFixed(2)} U` : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {carbEntries.length} carb {carbEntries.length === 1 ? 'entry' : 'entries'}
        {carbs ? ` (${carbs} g)` : ''}, {total.toFixed(1)} U from boluses. Automatic corrections are estimated,
        because the pump export does not mark which boluses Control-IQ gave.
      </p>
    </div>
  )
}
