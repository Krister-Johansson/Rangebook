import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { minutesOf } from '#/components/changes/add-change-sheet'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { longDate } from '#/lib/glucose/format'
import { addLifeLogEntry } from '#/server/life-log'

export function AddNoteSheet({
  day,
  open,
  onOpenChange,
}: {
  day: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl sm:bottom-4 sm:rounded-xl sm:border"
      >
        <SheetHeader>
          <SheetTitle>Add a note</SheetTitle>
          <SheetDescription>For {longDate(day)}. It goes into your life log.</SheetDescription>
        </SheetHeader>
        {open ? <AddNoteForm day={day} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function AddNoteForm({ day, onDone }: { day: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm({
    defaultValues: { time: '', text: '', author: 'you' as 'you' | 'parent' },
    onSubmit: async ({ value }) => {
      try {
        await addLifeLogEntry({
          data: { kind: 'note', startDate: day, atMin: minutesOf(value.time), text: value.text.trim(), author: value.author },
        })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['lifelog'] }),
          queryClient.invalidateQueries({ queryKey: ['glucose'] }),
        ])
        toast.success('Note added')
        onDone()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save the note')
      }
    },
  })

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="grid gap-4 px-4">
        <form.Field
          name="text"
          validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Write a short note') }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor="note-text">Note</Label>
              <Textarea
                id="note-text"
                rows={3}
                maxLength={500}
                placeholder="For example: sports day, late party, new sensor"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {field.state.meta.errors.length ? (
                <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
              ) : null}
            </div>
          )}
        </form.Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <form.Field name="time">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor="note-time">
                  Time <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="note-time"
                  type="time"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="author">
            {(field) => (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium" id="note-who">
                  Written by
                </span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  aria-labelledby="note-who"
                  value={field.state.value}
                  onValueChange={(v) => {
                    if (v) field.handleChange(v as 'you' | 'parent')
                  }}
                  className="justify-self-start"
                >
                  <ToggleGroupItem value="you">You</ToggleGroupItem>
                  <ToggleGroupItem value="parent">Parent</ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
          </form.Field>
        </div>
      </div>
      <SheetFooter className="flex-row justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving' : 'Save'}
            </Button>
          )}
        </form.Subscribe>
      </SheetFooter>
    </form>
  )
}
