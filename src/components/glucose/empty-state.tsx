import { Link } from '@tanstack/react-router'
import { Upload } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export function EmptyState() {
  return (
    <Card className="mx-auto mt-8 max-w-md text-center">
      <CardHeader>
        <CardTitle>No data yet</CardTitle>
        <CardDescription>Import a pump export to see your trends.</CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link to="/import">
            <Upload className="size-4" />
            Import data
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
