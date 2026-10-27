import { useLiveQuery } from '@tanstack/react-db'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientOnly, Link } from '@tanstack/react-router'
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
import { savedQuestionsCollection } from '#/lib/collections'
import { shortDate } from '#/lib/glucose/format'
import { lifeLogQuery, patternsQuery, settingsTimelineQuery } from '#/lib/queries'

// Saved questions live in a TanStack DB collection that only exists in the
// browser, so everything that reads it renders inside <ClientOnly>.

/** Saving gives XP once per question, so progress is refetched after a toggle. */
function useToggleSaved() {
  const queryClient = useQueryClient()
  return (patternId: string, question: string, saved: boolean) => {
    // Same as toggleSavedQuestion in collections.ts, keeping the transaction
    // so progress is refetched once the server has the change.
    const tx = saved
      ? savedQuestionsCollection.delete(patternId)
      : savedQuestionsCollection.insert({ patternId, question, createdAt: new Date().toISOString() })
    tx.isPersisted.promise.then(
      () => queryClient.invalidateQueries({ queryKey: ['glucose', 'progress'] }),
      () => toast.error('That change was not saved. Try again.'),
    )
  }
}

/** Where a saved question came from: a pattern, a settings change or an activity. */
function QuestionSource({ patternId }: { patternId: string }) {
  const { data: patterns } = useQuery(patternsQuery)
  const { data: log } = useQuery(lifeLogQuery)
  const { data: timeline } = useQuery(settingsTimelineQuery)
  const cls = 'w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground'

  if (patternId.startsWith('change-')) {
    const id = patternId.slice('change-'.length)
    const change = timeline?.find((c) => c.id === id)
    return (
      <Link to="/trends/changes/$changeId" params={{ changeId: id }} search={{ days: 14 }} className={cls}>
        From: {change ? `Change on ${shortDate(change.day)}` : 'A settings change'}
      </Link>
    )
  }
  if (patternId.startsWith('activity-')) {
    const id = patternId.slice('activity-'.length)
    const activity = log?.find((e) => String(e.id) === id)
    return (
      <Link to="/log/activity/$activityId" params={{ activityId: id }} className={cls}>
        From: {activity ? activity.text : 'An activity'}
      </Link>
    )
  }
  const pattern = patterns?.patterns.find((p) => p.id === patternId)
  if (!pattern) return <span className="text-xs text-muted-foreground">From: a pattern not found in the latest data</span>
  return (
    <Link to="/patterns/$patternId" params={{ patternId }} className={cls}>
      From: {pattern.title}
    </Link>
  )
}

/** Number of saved questions, for tab labels. Renders nothing on the server. */
export function SavedCount() {
  return (
    <ClientOnly fallback={null}>
      <SavedCountInner />
    </ClientOnly>
  )
}

function SavedCountInner() {
  const { data, isReady } = useSavedQuestions()
  if (!isReady) return null
  return <span className="tabular-nums">({(data ?? []).length})</span>
}

/** True when the question is saved. Client only. */
export function SavedMark({ patternId }: { patternId: string }) {
  return (
    <ClientOnly fallback={null}>
      <SavedMarkInner patternId={patternId} />
    </ClientOnly>
  )
}

function SavedMarkInner({ patternId }: { patternId: string }) {
  const { data } = useSavedQuestions()
  if (!(data ?? []).some((s) => s.patternId === patternId)) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
      <BookmarkCheck aria-hidden="true" className="size-3.5" />
      Saved
    </span>
  )
}

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
  const toggle = useToggleSaved()
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
            : 'Save a question from a pattern, a settings change or an activity. It stays here until your next visit.'}
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
                <span className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
                  <span className="leading-relaxed">{s.question}</span>
                  <QuestionSource patternId={s.patternId} />
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => toggle(s.patternId, s.question, true)}
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
  const toggle = useToggleSaved()
  if (!isReady) return <Skeleton className="h-8 w-36 rounded-md" />
  const saved = (data ?? []).some((s) => s.patternId === patternId)
  return (
    <Button
      variant={saved ? 'secondary' : 'default'}
      size="sm"
      aria-pressed={saved}
      onClick={() => toggle(patternId, question, saved)}
    >
      {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      {saved ? 'Saved for clinic' : 'Save for clinic'}
    </Button>
  )
}
