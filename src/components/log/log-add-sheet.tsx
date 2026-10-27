import { useForm } from '@tanstack/react-form'
import { NotebookText, Repeat, Tag } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useIsMobile } from '#/hooks/use-mobile'
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '#/lib/glucose/format'
import { TAG_KINDS } from '#/lib/glucose/lifelog'
import type { TagKind } from '#/lib/glucose/lifelog'

import { clockMin, todayLocal, useLifeLogMutations } from './parts'

export type AddType = 'tag' | 'activity' | 'note'
type Author = 'you' | 'parent'

function FieldError({ errors }: { errors: unknown[] }) {
  const text = errors.filter(Boolean).join(', ')
  return text ? (
    <p role="alert" className="text-sm text-destructive">
      {text}
    </p>
  ) : null
}

function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ?? 'flex min-w-0 flex-col gap-1.5'}>{children}</div>
}

function AuthorPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: Author
  onChange: (v: Author) => void
}) {
  return (
    <Field>
      <span id={id} className="text-sm font-medium">
        Added by
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-labelledby={id}
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as Author)
        }}
      >
        <ToggleGroupItem value="you">You</ToggleGroupItem>
        <ToggleGroupItem value="parent">Parent</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  )
}

function Footer({ onCancel, busy }: { onCancel: () => void; busy: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving' : 'Save'}
      </Button>
    </div>
  )
}

function TagForm({ onDone }: { onDone: () => void }) {
  const { add } = useLifeLogMutations()
  const today = todayLocal()
  const form = useForm({
    defaultValues: {
      tag: 'sick' as TagKind,
      startDate: today,
      endDate: today,
      text: '',
      author: 'you' as Author,
    },
    onSubmit: async ({ value }) => {
      await add.mutateAsync({ kind: 'tag', ...value, text: value.text.trim() })
      toast.success('Days added to your life log')
      onDone()
    },
  })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field name="tag">
        {(field) => (
          <Field>
            <span id="tag-kind-label" className="text-sm font-medium">
              These days were
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-labelledby="tag-kind-label"
              value={field.state.value}
              onValueChange={(v) => {
                if (v) field.handleChange(v as TagKind)
              }}
              spacing={1.5}
              className="flex-wrap justify-start"
            >
              {TAG_KINDS.map((k) => (
                <ToggleGroupItem key={k.id} value={k.id} className="flex-none px-3">
                  {k.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="startDate">
          {(field) => (
            <Field>
              <Label htmlFor="tag-from">From</Label>
              <Input
                id="tag-from"
                type="date"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="endDate"
          validators={{
            onChangeListenTo: ['startDate'],
            onChange: ({ value, fieldApi }) =>
              value < fieldApi.form.getFieldValue('startDate')
                ? 'The last day is before the first day'
                : undefined,
          }}
        >
          {(field) => (
            <Field>
              <Label htmlFor="tag-to">To</Label>
              <Input
                id="tag-to"
                type="date"
                required
                value={field.state.value}
                aria-invalid={field.state.meta.errors.length > 0}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.fieldMeta.endDate?.errors ?? []}>
        {(errors) => <FieldError errors={errors} />}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.values.tag}>
        {(tag) => (
          <form.Field
            name="text"
            validators={{
              onChangeListenTo: ['tag'],
              onSubmit: ({ value, fieldApi }) =>
                fieldApi.form.getFieldValue('tag') === 'other' && !value.trim()
                  ? 'Write what was different'
                  : undefined,
            }}
          >
            {(field) => (
              <Field>
                <Label htmlFor="tag-note">{tag === 'other' ? 'Note' : 'Note (optional)'}</Label>
                <Input
                  id="tag-note"
                  maxLength={200}
                  value={field.state.value}
                  placeholder={tag === 'other' ? 'What was different?' : undefined}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <p className="text-sm text-muted-foreground">
        Tagged days are marked on the charts. One switch can leave them out of patterns and
        comparisons.
      </p>
      <form.Field name="author">
        {(field) => <AuthorPicker id="tag-author" value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      <Footer onCancel={onDone} busy={add.isPending} />
    </form>
  )
}

function ActivityForm({ onDone }: { onDone: () => void }) {
  const { add } = useLifeLogMutations()
  const form = useForm({
    defaultValues: {
      text: '',
      weekdays: [] as string[],
      start: '17:00',
      end: '18:00',
      startDate: todayLocal(),
      endDate: '',
      author: 'you' as Author,
    },
    onSubmit: async ({ value }) => {
      await add.mutateAsync({
        kind: 'activity',
        text: value.text.trim(),
        weekdays: value.weekdays.map(Number),
        startMin: clockMin(value.start),
        endMin: clockMin(value.end),
        startDate: value.startDate,
        endDate: value.endDate || null,
        author: value.author,
      })
      toast.success('Activity added to your life log')
      onDone()
    },
  })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="text"
        validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Give the activity a name') }}
      >
        {(field) => (
          <Field>
            <Label htmlFor="act-name">Activity</Label>
            <Input
              id="act-name"
              maxLength={60}
              value={field.state.value}
              placeholder="For example: swimming"
              aria-invalid={field.state.meta.errors.length > 0}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field
        name="weekdays"
        validators={{ onSubmit: ({ value }) => (value.length ? undefined : 'Pick at least one day') }}
      >
        {(field) => (
          <Field>
            <span id="act-days-label" className="text-sm font-medium">
              Days
            </span>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              aria-labelledby="act-days-label"
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v)}
              spacing={1.5}
              className="flex-wrap justify-start"
            >
              {WEEKDAY_SHORT.map((d, i) => (
                <ToggleGroupItem key={d} value={String(i)} aria-label={WEEKDAY_LONG[i]} className="flex-none px-2.5">
                  {d}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="start">
          {(field) => (
            <Field>
              <Label htmlFor="act-start">From</Label>
              <Input
                id="act-start"
                type="time"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="end"
          validators={{
            onChangeListenTo: ['start'],
            onChange: ({ value, fieldApi }) =>
              value && clockMin(value) <= clockMin(fieldApi.form.getFieldValue('start'))
                ? 'The end is before the start'
                : undefined,
          }}
        >
          {(field) => (
            <Field>
              <Label htmlFor="act-end">To</Label>
              <Input
                id="act-end"
                type="time"
                required
                value={field.state.value}
                aria-invalid={field.state.meta.errors.length > 0}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.fieldMeta.end?.errors ?? []}>
        {(errors) => <FieldError errors={errors} />}
      </form.Subscribe>
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="startDate">
          {(field) => (
            <Field>
              <Label htmlFor="act-from">Starts</Label>
              <Input
                id="act-from"
                type="date"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="endDate"
          validators={{
            onChangeListenTo: ['startDate'],
            onChange: ({ value, fieldApi }) =>
              value && value < fieldApi.form.getFieldValue('startDate')
                ? 'The end date is before the start date'
                : undefined,
          }}
        >
          {(field) => (
            <Field>
              <Label htmlFor="act-to">Ends (optional)</Label>
              <Input
                id="act-to"
                type="date"
                value={field.state.value}
                aria-invalid={field.state.meta.errors.length > 0}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.fieldMeta.endDate?.errors ?? []}>
        {(errors) => <FieldError errors={errors} />}
      </form.Subscribe>
      <form.Field name="author">
        {(field) => <AuthorPicker id="act-author" value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      <Footer onCancel={onDone} busy={add.isPending} />
    </form>
  )
}

function NoteForm({ onDone, day }: { onDone: () => void; day?: string }) {
  const { add } = useLifeLogMutations()
  const form = useForm({
    defaultValues: {
      startDate: day ?? todayLocal(),
      time: '',
      text: '',
      author: 'you' as Author,
    },
    onSubmit: async ({ value }) => {
      await add.mutateAsync({
        kind: 'note',
        text: value.text.trim(),
        startDate: value.startDate,
        atMin: value.time ? clockMin(value.time) : null,
        author: value.author,
      })
      toast.success('Note added to your life log')
      onDone()
    },
  })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="startDate">
          {(field) => (
            <Field>
              <Label htmlFor="note-day">Day</Label>
              <Input
                id="note-day"
                type="date"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="time">
          {(field) => (
            <Field>
              <Label htmlFor="note-time">Time (optional)</Label>
              <Input
                id="note-time"
                type="time"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </div>
      <form.Field
        name="text"
        validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Write the note first') }}
      >
        {(field) => (
          <Field>
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              rows={3}
              maxLength={500}
              value={field.state.value}
              placeholder="For example: sports day at school"
              aria-invalid={field.state.meta.errors.length > 0}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="author">
        {(field) => <AuthorPicker id="note-author" value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      <Footer onCancel={onDone} busy={add.isPending} />
    </form>
  )
}

/** Add sheet for the life log: Days, Activity and Note tabs. */
export function LogAddSheet({
  open,
  onOpenChange,
  type,
  onTypeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: AddType
  onTypeChange: (type: AddType) => void
}) {
  const isMobile = useIsMobile()
  const close = () => onOpenChange(false)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile ? 'max-h-[92dvh] overflow-y-auto rounded-t-2xl' : 'w-full overflow-y-auto sm:max-w-md'
        }
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Add to your life log</SheetTitle>
          <SheetDescription>It shows on the charts, so a different day makes sense later.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <Tabs value={type} onValueChange={(v) => onTypeChange(v as AddType)} className="gap-4">
            <TabsList aria-label="What to log" className="w-full">
              <TabsTrigger value="tag">
                <Tag aria-hidden="true" />
                Days
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Repeat aria-hidden="true" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="note">
                <NotebookText aria-hidden="true" />
                Note
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tag">
              <TagForm onDone={close} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityForm onDone={close} />
            </TabsContent>
            <TabsContent value="note">
              <NoteForm onDone={close} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
