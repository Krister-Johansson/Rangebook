import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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
import { addSettingsNote } from '#/server/life-log'

export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "17:30" -> 1050, "" -> null */
export function minutesOf(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  return +time.slice(0, 2) * 60 + +time.slice(3, 5)
}

export function AddChangeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl sm:bottom-4 sm:rounded-xl sm:border">
        <SheetHeader>
          <SheetTitle>Add a change</SheetTitle>
          <SheetDescription>For changes the export does not show, like a clinic visit or a call.</SheetDescription>
        </SheetHeader>
        {open ? <AddChangeForm onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function AddChangeForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm({
    defaultValues: { day: localToday(), time: '', note: '', author: 'parent' as 'you' | 'parent' },
    onSubmit: async ({ value }) => {
      try {
        await addSettingsNote({
          data: { day: value.day, atMin: minutesOf(value.time), note: value.note.trim(), author: value.author },
        })
        await queryClient.invalidateQueries({ queryKey: ['glucose'] })
        toast.success('Change added')
        onDone()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save the change')
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
        <div className="grid grid-cols-2 gap-3">
          <form.Field
            name="day"
            validators={{ onSubmit: ({ value }) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : 'Pick a date') }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor="ch-day">Date</Label>
                <Input
                  id="ch-day"
                  type="date"
                  value={field.state.value}
                  max={localToday()}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors.length ? (
                  <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Field name="time">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor="ch-time">
                  Time <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="ch-time"
                  type="time"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>
        <form.Field
          name="note"
          validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Write what changed') }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor="ch-note">What changed</Label>
              <Textarea
                id="ch-note"
                rows={3}
                maxLength={500}
                placeholder="For example: clinic visit, new lunch ratio"
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
        <form.Field name="author">
          {(field) => (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium" id="ch-who">
                Added by
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                aria-labelledby="ch-who"
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
