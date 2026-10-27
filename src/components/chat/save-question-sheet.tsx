import { useForm } from '@tanstack/react-form'
import { useLiveQuery } from '@tanstack/react-db'
import { useQueryClient } from '@tanstack/react-query'
import { ClientOnly } from '@tanstack/react-router'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
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
import { savedQuestionsCollection } from '#/lib/collections'
import { DOSE_VALUE_MESSAGE, hasDoseValue } from '#/lib/dose-guard'

import { lastQuestion } from './text'

/** Save for clinic under an answer. Opens a sheet to edit the question first. */
export function SaveFromAnswer({ patternId, answer }: { patternId: string; answer: string }) {
  return (
    <ClientOnly fallback={null}>
      <SaveFromAnswerInner patternId={patternId} answer={answer} />
    </ClientOnly>
  )
}

function SaveFromAnswerInner({ patternId, answer }: { patternId: string; answer: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data, isReady } = useLiveQuery((q) => q.from({ s: savedQuestionsCollection }))
  const saved = isReady && (data ?? []).some((s) => s.patternId === patternId)

  const remove = () => {
    // Same as toggleSavedQuestion, keeping the transaction so errors show
    // and progress refreshes once the server has the change.
    savedQuestionsCollection.delete(patternId).isPersisted.promise.then(
      () => {
        toast('Removed from For clinic')
        return queryClient.invalidateQueries({ queryKey: ['glucose', 'progress'] })
      },
      () => toast.error('That change was not saved. Try again.'),
    )
  }

  return (
    <>
      <Button
        variant={saved ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 px-2.5 text-xs"
        aria-pressed={saved}
        disabled={!isReady}
        onClick={() => (saved ? remove() : setOpen(true))}
      >
        {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        {saved ? 'Saved for clinic' : 'Save for clinic'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl sm:bottom-4 sm:rounded-xl sm:border"
        >
          <SheetHeader>
            <SheetTitle>Save a question for clinic</SheetTitle>
            <SheetDescription>
              It goes to Patterns, For clinic, so you remember it at the next visit. Change the words if you like.
            </SheetDescription>
          </SheetHeader>
          {open ? <SaveForm patternId={patternId} initial={lastQuestion(answer)} onDone={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function SaveForm({ patternId, initial, onDone }: { patternId: string; initial: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm({
    defaultValues: { question: initial },
    onSubmit: async ({ value }) => {
      const question = value.question.trim()
      const tx = savedQuestionsCollection.insert({ patternId, question, createdAt: new Date().toISOString() })
      try {
        await tx.isPersisted.promise
        await queryClient.invalidateQueries({ queryKey: ['glucose', 'progress'] })
        toast.success('Saved for clinic', { description: 'It is in Patterns, For clinic.' })
        onDone()
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : 'Could not save the question. Try again.')
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
          name="question"
          validators={{
            onSubmit: ({ value }) => {
              const v = value.trim()
              if (v.length < 10) return 'Write the question in a few words.'
              if (hasDoseValue(v)) return DOSE_VALUE_MESSAGE
              return undefined
            },
          }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor="clinic-question">Question for your care team</Label>
              <Textarea
                id="clinic-question"
                rows={4}
                maxLength={500}
                className="text-base md:text-sm"
                placeholder="For example: Why do lows often come about 2 hours after lunch?"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
                aria-describedby="clinic-question-help"
              />
              {field.state.meta.errors.length ? (
                <p id="clinic-question-help" role="alert" className="text-sm text-destructive">
                  {field.state.meta.errors.join(' ')}
                </p>
              ) : (
                <p id="clinic-question-help" className="text-xs text-muted-foreground">
                  Leave out numbers for insulin or ratios. The care team looks at those with you.
                </p>
              )}
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
              <Bookmark aria-hidden="true" />
              {submitting ? 'Saving' : 'Save for clinic'}
            </Button>
          )}
        </form.Subscribe>
      </SheetFooter>
    </form>
  )
}
