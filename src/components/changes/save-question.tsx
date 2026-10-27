import { useLiveQuery } from '@tanstack/react-db'
import { useQueryClient } from '@tanstack/react-query'
import { ClientOnly } from '@tanstack/react-router'
import { Bookmark, BookmarkCheck } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { savedQuestionsCollection } from '#/lib/collections'

// The saved questions collection only exists in the browser.
export function SaveForClinicButton({ patternId, question }: { patternId: string; question: string }) {
  return (
    <ClientOnly fallback={<Skeleton className="h-8 w-36 rounded-md" />}>
      <SaveToggle patternId={patternId} question={question} />
    </ClientOnly>
  )
}

function SaveToggle({ patternId, question }: { patternId: string; question: string }) {
  const queryClient = useQueryClient()
  const { data, isReady } = useLiveQuery((q) => q.from({ s: savedQuestionsCollection }))
  if (!isReady) return <Skeleton className="h-8 w-36 rounded-md" />
  const saved = (data ?? []).some((s) => s.patternId === patternId)
  return (
    <Button
      variant={saved ? 'secondary' : 'default'}
      size="sm"
      aria-pressed={saved}
      onClick={() => {
        // Same as toggleSavedQuestion, but keeps the transaction so progress
        // (saving gives XP once per question) refreshes after the write lands.
        const tx = saved
          ? savedQuestionsCollection.delete(patternId)
          : savedQuestionsCollection.insert({ patternId, question, createdAt: new Date().toISOString() })
        tx.isPersisted.promise
          .then(() => queryClient.invalidateQueries({ queryKey: ['glucose', 'progress'] }))
          .catch(() => {})
      }}
    >
      {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      {saved ? 'Saved for clinic' : 'Save for clinic'}
    </Button>
  )
}
