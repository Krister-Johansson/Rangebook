import { useForm } from '@tanstack/react-form'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, Pencil, Trash2, Upload, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Initial } from '#/components/person-switcher'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { shortDate } from '#/lib/glucose/format'
import { peopleQuery } from '#/lib/queries'
import { refreshForPerson, useSwitchPerson } from '#/lib/use-switch-person'
import { createPerson, deletePerson, renamePerson } from '#/server/people'
import type { Person } from '#/server/people'

export const Route = createFileRoute('/people')({
  loader: ({ context }) => context.queryClient.ensureQueryData(peopleQuery),
  component: PeoplePage,
})

const nameError = (value: string) => (value.trim() ? undefined : 'Enter a name')

function PeoplePage() {
  const { data } = useSuspenseQuery(peopleQuery)
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-[22px] leading-tight font-bold tracking-tight">People</h1>
        <p className="text-sm text-muted-foreground">
          Each person has their own imports, patterns, goal and saved questions. Pick who you are looking
          at from the menu at the top of the sidebar.
        </p>
      </div>
      {data.people.length ? (
        <ul className="flex flex-col gap-3">
          {data.people.map((p) => (
            <li key={p.id}>
              <PersonCard person={p} active={p.id === data.activeId} />
            </li>
          ))}
        </ul>
      ) : null}
      <AddPerson first={data.people.length === 0} />
    </div>
  )
}

function AddPerson({ first }: { first: boolean }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value, formApi }) => {
      try {
        await createPerson({ data: { name: value.name.trim() } })
        await refreshForPerson(queryClient, router)
        toast.success(`Added ${value.name.trim()}`)
        formApi.reset()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add the person')
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{first ? 'Add the first person' : 'Add a person'}</CardTitle>
        <CardDescription>
          A first name or nickname is enough. It is only used in this app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <form.Field name="name" validators={{ onSubmit: ({ value }) => nameError(value) }}>
            {(field) => (
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor="new-person">Name</Label>
                <Input
                  id="new-person"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                />
                {field.state.meta.errors.length ? (
                  <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" disabled={submitting}>
                <UserPlus />
                Add
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}

function PersonCard({ person, active }: { person: Person; active: boolean }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const switchPerson = useSwitchPerson()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm({
    defaultValues: { name: person.name },
    onSubmit: async ({ value }) => {
      try {
        await renamePerson({ data: { id: person.id, name: value.name.trim() } })
        await queryClient.invalidateQueries({ queryKey: ['people'] })
        setEditing(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not rename')
      }
    },
  })

  const remove = async () => {
    try {
      await deletePerson({ data: { id: person.id } })
      await refreshForPerson(queryClient, router)
      toast.success(`Deleted ${person.name} and their data`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete')
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Initial name={person.name} className="size-9 text-sm" />
          {editing ? (
            <form
              className="flex min-w-48 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
            >
              <form.Field name="name" validators={{ onSubmit: ({ value }) => nameError(value) }}>
                {(field) => (
                  <Input
                    aria-label="Name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    maxLength={60}
                    autoFocus
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                )}
              </form.Field>
              <Button type="submit" size="sm">
                <Check />
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">
                <span className="truncate">{person.name}</span>
                {active ? <Badge variant="secondary">Showing now</Badge> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {person.imports
                  ? `${person.imports} import${person.imports === 1 ? '' : 's'}, data up to ${shortDate(person.lastData!.slice(0, 10))}`
                  : 'No data yet'}
              </div>
            </div>
          )}
          {!editing ? (
            <div className="flex flex-wrap gap-2">
              {!active ? (
                <Button size="sm" variant="outline" onClick={() => switchPerson(person.id)}>
                  Show
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${person.name}`}>
                <Pencil />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                aria-label={`Delete ${person.name}`}
              >
                <Trash2 />
              </Button>
            </div>
          ) : null}
        </div>
        {active && person.imports === 0 ? (
          <Button size="sm" variant="outline" asChild className="self-start">
            <Link to="/import">
              <Upload />
              Import data for {person.name}
            </Link>
          </Button>
        ) : null}
        {confirmDelete ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm">
            <span className="flex-1">
              Delete {person.name}, {person.imports ? `their ${person.imports} import${person.imports === 1 ? '' : 's'} ` : ''}
              and saved questions? This cannot be undone.
            </span>
            <Button size="sm" variant="destructive" onClick={remove}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
