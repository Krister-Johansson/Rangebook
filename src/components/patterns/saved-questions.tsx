import { useLiveQuery } from '@tanstack/react-db'
import { ClientOnly } from '@tanstack/react-router'
import { Bookmark, BookmarkCheck, Check, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { savedQuestionsCollection, toggleSavedQuestion } from '#/lib/collections'

// Saved questions live in a TanStack DB collection that only exists in the
// browser, so everything that reads it renders inside <ClientOnly>.

function useSavedQuestions() {
  return useLiveQuery((q) =>
    q.from({ s: savedQuestionsCollection }).orderBy(({ s }) => s.createdAt),
  )
}

export function SavedQuestionsCard() {
  return (
    <ClientOnly fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
      <SavedQuestionsList />
    </ClientOnly>
  )
}

function SavedQuestionsList() {
  const { data, isReady } = useSavedQuestions()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!isReady) return <Skeleton className="h-24 w-full rounded-xl" />
  const items = data ?? []

  const copy = async () => {
    const text = items.map((s, i) => `${i + 1}. ${s.question}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the list. Try selecting the text instead.')
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2>Questions for clinic</h2>
        </CardTitle>
        <CardDescription>
          {items.length
            ? 'Bring these to your next visit, or share them when you choose.'
            : 'Save a question from a pattern below. It stays here until your next visit.'}
        </CardDescription>
        <CardAction>
          {items.length ? (
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span aria-live="polite">{copied ? 'Copied' : 'Copy list'}</span>
            </Button>
          ) : (
            <Badge variant="secondary" aria-label="No saved questions">
              0
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      {items.length ? (
        <CardContent className="px-4 sm:px-6">
          <ol className="flex flex-col gap-2">
            {items.map((s, i) => (
              <li key={s.patternId} className="flex items-start gap-2 text-sm">
                <span className="pt-1.5 font-semibold tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1 pt-1.5 leading-relaxed">{s.question}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => toggleSavedQuestion(s.patternId, s.question, true)}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function SaveQuestionButton({
  patternId,
  question,
}: {
  patternId: string
  question: string
}) {
  return (
    <ClientOnly fallback={<Skeleton className="h-8 w-36 rounded-md" />}>
      <SaveToggle patternId={patternId} question={question} />
    </ClientOnly>
  )
}

function SaveToggle({ patternId, question }: { patternId: string; question: string }) {
  const { data, isReady } = useSavedQuestions()
  if (!isReady) return <Skeleton className="h-8 w-36 rounded-md" />
  const saved = (data ?? []).some((s) => s.patternId === patternId)
  return (
    <Button
      variant={saved ? 'secondary' : 'default'}
      size="sm"
      aria-pressed={saved}
      onClick={() => toggleSavedQuestion(patternId, question, saved)}
    >
      {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      {saved ? 'Saved for clinic' : 'Save for clinic'}
    </Button>
  )
}
