import { useForm } from '@tanstack/react-form'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { CheckCircle2, Loader2, Trash2, TriangleAlert, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable, SortHeader, sortableFeatures } from '#/components/data-table'
import { DropZone, isAcceptedFile } from '#/components/import/drop-zone'
import { ImportDoneSheet } from '#/components/import/import-done-sheet'
import type { ImportDone } from '#/components/import/import-done-sheet'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { importsQuery, overviewQuery, peopleQuery, prefsQuery, progressQuery } from '#/lib/queries'
import { refreshForPerson } from '#/lib/use-switch-person'
import { deleteImport, ingestExport } from '#/server/imports'
import type { IngestResponse } from '#/server/imports'
import type { IngestResult } from '#/server/ingest'
import { setActivePerson } from '#/server/people'

export const Route = createFileRoute('/import')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(peopleQuery),
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

type Check = Extract<IngestResponse, { status: 'check' }>

function ImportPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: peopleData } = useSuspenseQuery(peopleQuery)
  const { people, activeId } = peopleData
  const [check, setCheck] = useState<Check | null>(null)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [done, setDone] = useState<ImportDone | null>(null)

  const mutation = useMutation({
    mutationFn: (fd: FormData) => ingestExport({ data: fd }),
    onError: (err) => toast.error(err.message),
  })

  const form = useForm({
    defaultValues: {
      files: [] as File[],
      personId: String(activeId ?? ''),
      replaceExisting: false,
    },
    onSubmit: ({ value }) => send(value, false),
  })

  async function send(
    value: { files: File[]; personId: string; replaceExisting: boolean },
    confirmed: boolean,
  ) {
    const fd = new FormData()
    value.files.forEach((f) => fd.append('files', f))
    fd.append('personId', value.personId)
    fd.append('replaceExisting', String(value.replaceExisting))
    fd.append('confirmed', String(confirmed))
    // Progress before the upload, to show what this import added.
    const before = await queryClient.fetchQuery(progressQuery).catch(() => null)
    const res = await mutation.mutateAsync(fd)
    if (res.status === 'check') {
      setCheck(res)
      setResult(null)
      return
    }
    setCheck(null)
    setResult(res.result)
    const name = people.find((p) => p.id === res.personId)?.name ?? 'this person'
    const rows = Object.values(res.result.summary).reduce((n, s) => n + s.inserted, 0)
    toast.success(`Imported ${rows.toLocaleString()} rows for ${name}`)
    if (res.personId !== activeId) await setActivePerson({ data: { id: res.personId } })
    await refreshForPerson(queryClient, router)
    form.reset({ files: [], personId: String(res.personId), replaceExisting: false })
    const [after, prefs] = await Promise.all([
      queryClient.fetchQuery(progressQuery).catch(() => null),
      queryClient.fetchQuery(prefsQuery).catch(() => null),
    ])
    setDone({
      before: res.personId === activeId ? before : null,
      after,
      pet: prefs?.pet ?? { name: 'Pip', color: 'sky' },
      from: res.result.rangeStart,
      to: res.result.rangeEnd,
    })
  }

  if (people.length === 0) {
    return (
      <Card className="mx-auto mt-8 max-w-md text-center">
        <CardHeader>
          <CardTitle>Add a person first</CardTitle>
          <CardDescription>
            Imports belong to a person, so a family with more than one child can keep each child's
            data apart.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link to="/people">
              <UserPlus />
              Add a person
            </Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const personName = (id: string) => people.find((p) => String(p.id) === id)?.name ?? 'this person'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import data</h1>
        <p className="text-muted-foreground">
          Drop the zip from the pump data export. Overlapping exports are fine: where two imports cover
          the same time, the one with the newest data is used.
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
            <form.Field name="personId">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="import-person">Whose export is this?</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => {
                      field.handleChange(v)
                      setCheck(null)
                    }}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger id="import-person" className="w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

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
                    onChange={(files) => {
                      field.handleChange(files)
                      setCheck(null)
                    }}
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

            <form.Subscribe selector={(s) => s.values.personId}>
              {(personId) => (
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
                        Delete {personName(personId)}'s earlier imports first
                      </Label>
                    </div>
                  )}
                </form.Field>
              )}
            </form.Subscribe>

            {check ? (
              <Alert role="alert" className="border-l-4" style={{ borderLeftColor: 'var(--band-high)' }}>
                <TriangleAlert />
                <AlertTitle>Is this the right person?</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <p>
                    The export is for {check.exportName}.{' '}
                    {check.knownNames.length
                      ? `Earlier exports for ${check.personName} were for ${check.knownNames.join(' and ')}.`
                      : ''}{' '}
                    {check.otherPerson
                      ? `Exports with this name are already stored for ${check.otherPerson.name}.`
                      : ''}{' '}
                    Nothing has been stored yet.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {check.otherPerson ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const personId = String(check.otherPerson!.id)
                          form.setFieldValue('personId', personId)
                          send({ ...form.state.values, personId }, true)
                        }}
                      >
                        Import for {check.otherPerson.name}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={check.otherPerson ? 'outline' : 'default'}
                      onClick={() => send(form.state.values, true)}
                    >
                      Import for {check.personName} anyway
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCheck(null)}>
                      Cancel
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter>
            <form.Subscribe selector={(s) => [s.canSubmit, s.values.files.length] as const}>
              {([canSubmit, count]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || count === 0 || mutation.isPending || !!check}
                >
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  {mutation.isPending ? 'Importing' : 'Import'}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>

      {result && <ImportResult result={result} />}
      <ImportDoneSheet
        done={done}
        onOpenChange={(open) => {
          if (!open) setDone(null)
        }}
      />

      <StoredData name={people.find((p) => p.id === activeId)?.name ?? ''} />
      <ImportHistory name={people.find((p) => p.id === activeId)?.name ?? ''} />
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
    header: ({ column }) => <SortHeader column={column} label="Stored" />,
    cell: (c) => c.getValue().toLocaleString(),
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

function StoredData({ name }: { name: string }) {
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
      <h2 className="text-lg font-semibold">Data in use for {name}</h2>
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
  exportName: string | null
  rangeStart: string | null
  rangeEnd: string | null
  createdAt: string
  rows: number
}
const historyHelper = createColumnHelper<typeof sortableFeatures, ImportRow>()

function ImportHistory({ name }: { name: string }) {
  const { data } = useSuspenseQuery(importsQuery)
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => deleteImport({ data: { id } }),
    onSuccess: () => {
      setConfirmId(null)
      toast.success('Import deleted')
      queryClient.invalidateQueries({ queryKey: ['imports'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      queryClient.invalidateQueries({ queryKey: ['glucose'] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const rows: ImportRow[] = data.map((imp) => ({
    id: imp.id,
    fileName: imp.fileName,
    exportName: imp.patientName,
    rangeStart: imp.rangeStart,
    rangeEnd: imp.rangeEnd,
    createdAt: new Date(imp.createdAt).toISOString(),
    rows: Object.values(imp.summary).reduce((n, s) => n + s.inserted, 0),
  }))

  const columns = historyHelper.columns([
    historyHelper.accessor('createdAt', {
      header: ({ column }) => <SortHeader column={column} label="Imported" />,
      cell: (c) => new Date(c.getValue()).toLocaleString('sv-SE'),
    }),
    historyHelper.accessor('fileName', { header: 'File' }),
    historyHelper.accessor('exportName', {
      header: 'Name in export',
      cell: (c) => c.getValue() ?? <span className="text-muted-foreground">Unknown</span>,
    }),
    historyHelper.display({
      id: 'range',
      header: 'Period',
      cell: ({ row }) =>
        row.original.rangeStart
          ? `${row.original.rangeStart} to ${row.original.rangeEnd}`
          : 'Unknown',
    }),
    historyHelper.accessor('rows', {
      header: ({ column }) => <SortHeader column={column} label="Rows" />,
      cell: (c) =>
        c.getValue() === 0 ? <Badge variant="secondary">Empty</Badge> : c.getValue().toLocaleString(),
    }),
    historyHelper.display({
      id: 'delete',
      header: () => <span className="sr-only">Delete</span>,
      cell: ({ row }) =>
        confirmId === row.original.id ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(row.original.id)}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
              Keep
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete import ${row.original.fileName}`}
              onClick={() => setConfirmId(row.original.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
    }),
  ])

  const table = useTable({
    features: sortableFeatures,
    data: rows,
    columns,
  })

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Imports for {name}</h2>
        <p className="text-sm text-muted-foreground">
          Deleting an import removes its rows. Where an older import covers the same days, its data is
          used again.
        </p>
      </div>
      <DataTable table={table} empty="No imports yet." />
    </section>
  )
}
