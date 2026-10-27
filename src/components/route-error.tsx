import { useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '#/components/ui/card'

/** Shown when a page fails to load, instead of the router's raw error screen. */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <Card className="mx-auto mt-8 max-w-md text-center">
      <CardHeader>
        <CardTitle>This page did not load</CardTitle>
        <CardDescription>
          Check that the database is running, then try again.
          {import.meta.env.DEV ? <span className="mt-2 block font-mono text-xs">{error instanceof Error ? error.message : String(error)}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Button onClick={() => router.invalidate()}>
          <RotateCw />
          Try again
        </Button>
      </CardFooter>
    </Card>
  )
}
