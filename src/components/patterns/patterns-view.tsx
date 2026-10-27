import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Info, Stethoscope } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Card, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { savedQuestionsCollection } from '#/lib/collections'
import { TARGETS } from '#/lib/glucose/core'
import { patternsQuery } from '#/lib/queries'

import { PatternCard, patternCardId } from './pattern-card'
import { SavedQuestionsCard } from './saved-questions'

const routeApi = getRouteApi('/patterns')

const HIGHLIGHT_MS = 2400

/** Scrolls to the card named in ?focus= and outlines it for a moment. */
function useFocusCard(focus: string | undefined) {
  const [highlighted, setHighlighted] = useState<string | undefined>()

  useEffect(() => {
    if (!focus) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame = 0

    const go = () => {
      if (cancelled) return
      const el = document.getElementById(patternCardId(focus))
      if (!el) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
      setHighlighted(focus)
      timer = setTimeout(() => setHighlighted(undefined), HIGHLIGHT_MS)
    }

    // The saved questions card above the patterns grows once its data loads.
    // Wait for it so the scroll target does not move afterwards.
    const afterPaint = () => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(go)
      })
    }
    savedQuestionsCollection.preload().then(afterPaint, afterPaint)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [focus])

  return highlighted
}

export function PatternsView() {
  const { data } = useSuspenseQuery(patternsQuery)
  const { focus } = routeApi.useSearch()
  const highlighted = useFocusCard(focus)

  if (!data) return null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight">Patterns</h1>
        <p className="max-w-[62ch] text-muted-foreground">
          Things that happen at the same time on many days, from the last {data.days} days.
          Each one comes with a question you can save for your care team.
        </p>
      </div>

      {data.lowsOverTarget ? (
        <Alert role="note">
          <Info aria-hidden="true" />
          <AlertTitle>Lows are listed first</AlertTitle>
          <AlertDescription>
            Time below 3.9 is {data.below39.toFixed(1)}%, over the {TARGETS.below39}% target, so
            lows come before highs. Clinics usually look at it in the same order.
          </AlertDescription>
        </Alert>
      ) : null}

      <SavedQuestionsCard />

      {data.patterns.length ? (
        <div className="flex flex-col gap-4">
          {data.patterns.map((p) => (
            <PatternCard key={p.id} pattern={p} focused={highlighted === p.id} />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>No repeating patterns found</h2>
            </CardTitle>
            <CardDescription>
              Nothing happened at the same time on enough days in the last {data.days} days to
              show here.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Alert role="note">
        <Stethoscope aria-hidden="true" />
        <AlertTitle>Your care team decides changes</AlertTitle>
        <AlertDescription>
          These are patterns from your data, not instructions. Nothing here changes your pump.
          Your care team decides if any setting changes.
        </AlertDescription>
      </Alert>
    </div>
  )
}
