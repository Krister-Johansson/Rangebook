import { useForm } from '@tanstack/react-form'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable, SortHeader, sortableFeatures } from '#/components/data-table'
import { DropZone, isAcceptedFile } from '#/components/import/drop-zone'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { importsQuery, overviewQuery } from '#/lib/queries'
import { ingestExport } from '#/server/imports'
import type { IngestResult } from '#/server/ingest'

export const Route = createFileRoute('/import')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(importsQuery),
      context.queryClient.ensureQueryData(overviewQuery),
    ]),
  component: ImportPage,
})

const KIND_LABELS: Record<string, string> = {
  cgm: 'CGM readings',
  bg: 'Fingerstick checks',
  bolus: 'Boluses',
  basal: 'Basal segments',
  insulin: 'Daily insulin totals',
  alarms: 'Alarms and events',
  cgm_carbs: 'CGM carbs',
  exercise: 'Exercise',
  food: 'Food',
  notes: 'Notes',
  manual_insulin: 'Manual insulin',
  medication: 'Medication',
}

function ImportPage() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (fd: FormData) => ingestExport({ data: fd }),
    onSuccess: (res) => {
      const total = Object.values(res.summary).reduce((n, s) => n + s.inserted, 0)
      toast.success(`Imported ${total.toLocaleString()} new rows`)
      queryClient.invalidateQueries({ queryKey: ['imports'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      queryClient.invalidateQueries({ queryKey: ['glucose'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const form = useForm({
    defaultValues: { files: [] as File[], replaceExisting: false },
    onSubmit: async ({ value, formApi }) => {
      const fd = new FormData()
      value.files.forEach((f) => fd.append('files', f))
      fd.append('replaceExisting', String(value.replaceExisting))
      await mutation.mutateAsync(fd)
      formApi.reset()
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import data</h1>
        <p className="text-muted-foreground">
          Drop the zip from the pump data export. Readings that are already
          stored are skipped, so importing an overlapping period is safe.
        </p>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <CardHeader>
            <CardTitle>Upload export</CardTitle>
            <CardDescription>
              Zip with cgm_data, bolus_data, basal_data and the other CSV files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <form.Field
              name="files"
              validators={{
                onChange: ({ value }) =>
                  value.length === 0
                    ? 'Add the export zip first'
                    : value.some((f) => !isAcceptedFile(f))
                      ? 'Only .zip and .csv files are supported'
                      : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <DropZone
                    files={field.state.value}
                    onChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="replaceExisting">
              {(field) => (
                <div className="flex items-center gap-3">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                  <Label htmlFor={field.name} className="font-normal">
                    Replace all stored data with this export
                  </Label>
                </div>
              )}
            </form.Field>
          </CardContent>
          <CardFooter>
            <form.Subscribe selector={(s) => [s.canSubmit, s.values.files.length] as const}>
              {([canSubmit, count]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || count === 0 || mutation.isPending}
                >
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  {mutation.isPending ? 'Importing' : 'Import'}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>

      {mutation.data && <ImportResult result={mutation.data} />}

      <StoredData />
      <ImportHistory />
    </div>
  )
}

type SummaryRow = { kind: string; files: string; parsed: number; inserted: number }
const summaryHelper = createColumnHelper<typeof sortableFeatures, SummaryRow>()
const summaryColumns = summaryHelper.columns([
  summaryHelper.accessor('kind', {
    header: ({ column }) => <SortHeader column={column} label="Data" />,
    cell: (c) => KIND_LABELS[c.getValue()] ?? c.getValue(),
  }),
  summaryHelper.accessor('files', {
    header: 'Files',
    cell: (c) => <span className="text-muted-foreground">{c.getValue()}</span>,
  }),
  summaryHelper.accessor('parsed', {
    header: ({ column }) => <SortHeader column={column} label="In file" />,
    cell: (c) => c.getValue().toLocaleString(),
  }),
  summaryHelper.accessor('inserted', {
    header: ({ column }) => <SortHeader column={column} label="New" />,
    cell: (c) => c.getValue().toLocaleString(),
  }),
  summaryHelper.display({
    id: 'skipped',
    header: 'Skipped as duplicate',
    cell: ({ row }) => (row.original.parsed - row.original.inserted).toLocaleString(),
  }),
])

function ImportResult({ result }: { result: IngestResult }) {
  const data: SummaryRow[] = Object.entries(result.summary)
    .map(([kind, s]) => ({
      kind,
      files: s.files.map((f) => f.split('/').pop()).join(', '),
      parsed: s.parsed,
      inserted: s.inserted,
    }))
    .sort((a, b) => b.parsed - a.parsed)

  const table = useTable({
    features: sortableFeatures,
    data,
    columns: summaryColumns,
  })

  return (
    <div className="space-y-3">
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertTitle>Import finished</AlertTitle>
        <AlertDescription>
          Export covers {result.rangeStart ?? '?'} to {result.rangeEnd ?? '?'}.
          {result.ignored.length > 0 &&
            ` Ignored ${result.ignored.length} unrecognised file(s): ${result.ignored.join(', ')}.`}{' '}
          <Link to="/" className="underline underline-offset-2">
            Open the dashboard
          </Link>
        </AlertDescription>
      </Alert>
      <DataTable table={table} />
    </div>
  )
}

function StoredData() {
  const { data } = useSuspenseQuery(overviewQuery)
  const items = [
    { label: 'CGM readings', ...data.cgm },
    { label: 'Boluses', ...data.bolus },
    { label: 'Basal segments', ...data.basal },
    { label: 'Fingerstick checks', ...data.bg },
    { label: 'Alarms', ...data.alarm },
  ]
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Stored data</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((it) => (
          <Card key={it.label} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardDescription>{it.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {it.rows.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">
              {it.first ? `${it.first.slice(0, 10)} to ${it.last?.slice(0, 10)}` : 'No data'}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

type ImportRow = {
  id: number
  fileName: string
  rangeStart: string | null
  rangeEnd: string | null
  createdAt: string
  inserted: number
}
const historyHelper = createColumnHelper<typeof sortableFeatures, ImportRow>()
const historyColumns = historyHelper.columns([
  historyHelper.accessor('createdAt', {
    header: ({ column }) => <SortHeader column={column} label="Imported" />,
    cell: (c) => new Date(c.getValue()).toLocaleString('sv-SE'),
  }),
  historyHelper.accessor('fileName', { header: 'File' }),
  historyHelper.display({
    id: 'range',
    header: 'Period',
    cell: ({ row }) =>
      row.original.rangeStart
        ? `${row.original.rangeStart} to ${row.original.rangeEnd}`
        : 'Unknown',
  }),
  historyHelper.accessor('inserted', {
    header: ({ column }) => <SortHeader column={column} label="New rows" />,
    cell: (c) =>
      c.getValue() === 0 ? (
        <Badge variant="secondary">No new data</Badge>
      ) : (
        c.getValue().toLocaleString()
      ),
  }),
])

function ImportHistory() {
  const { data } = useSuspenseQuery(importsQuery)
  const rows: ImportRow[] = data.map((imp) => ({
    id: imp.id,
    fileName: imp.fileName,
    rangeStart: imp.rangeStart,
    rangeEnd: imp.rangeEnd,
    createdAt: new Date(imp.createdAt).toISOString(),
    inserted: Object.values(imp.summary).reduce((n, s) => n + s.inserted, 0),
  }))

  const table = useTable({
    features: sortableFeatures,
    data: rows,
    columns: historyColumns,
  })

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Import history</h2>
      <DataTable table={table} empty="No imports yet." />
    </section>
  )
}
