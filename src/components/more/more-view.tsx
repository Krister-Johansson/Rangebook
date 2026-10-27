import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Bot, Database, Gauge, MessageCircle, NotebookPen, UserRound, Users } from 'lucide-react'

import { CompanionSvg } from '#/components/companion/companion-svg'
import { Card, CardContent } from '#/components/ui/card'
import { shortDate } from '#/lib/glucose/format'
import { dataRangeQuery, overviewQuery, prefsQuery } from '#/lib/queries'

import { NavRow } from './page-head'
import { SHARE_ITEMS } from './prefs'

function dataSub(range: { lastDay: string; lastTs: string } | null, readings: number | undefined) {
  if (!range) return 'No data imported yet'
  const last = `Last reading ${shortDate(range.lastDay)} at ${range.lastTs.slice(11, 16)}`
  return readings ? `${last}. ${readings.toLocaleString('en-GB')} sensor readings.` : `${last}.`
}

export function MoreView() {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data: range } = useSuspenseQuery(dataRangeQuery)
  const { data: overview } = useQuery(overviewQuery)
  const shared = SHARE_ITEMS.filter((s) => prefs.sharing[s.id]).length
  const name = prefs.pet.name.trim() || 'Pip'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-[22px] leading-tight font-bold tracking-tight">More</h1>
      <Card className="py-2">
        <CardContent className="px-2">
          <nav aria-label="More">
            <ul className="flex flex-col">
              <li>
                <NavRow
                  to={{ to: '/more/sharing' }}
                  icon={<Users />}
                  title="What your parent sees"
                  sub={`${shared} of ${SHARE_ITEMS.length} shared. You decide.`}
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/log' }}
                  icon={<NotebookPen />}
                  title="Life log"
                  sub="Not-normal days, notes and activities"
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/more/system' }}
                  icon={<Gauge />}
                  title="System check"
                  sub="Sensor, carbs entered, pump stops"
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/more/look' }}
                  icon={<CompanionSvg stage={4} mood="happy" color={prefs.pet.color} size={28} still />}
                  title="Look"
                  sub={`Theme, and ${name}'s name and color`}
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/people' }}
                  icon={<UserRound />}
                  title="People"
                  sub="Each person has their own data, patterns and questions"
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/more/chat' }}
                  icon={<MessageCircle />}
                  title="Ask settings"
                  sub="Model, privacy and chats for the in-app chat"
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/ask-claude', search: { app: 'desktop' } }}
                  icon={<Bot />}
                  title="Ask Claude"
                  sub="Let Claude read the same numbers and patterns"
                />
              </li>
              <li>
                <NavRow
                  to={{ to: '/import' }}
                  icon={<Database />}
                  title="Data and import"
                  sub={dataSub(range, overview?.cgm.rows)}
                />
              </li>
            </ul>
          </nav>
        </CardContent>
      </Card>
      <p className="max-w-prose text-xs text-muted-foreground">
        Rangebook is not a medical device. It shows patterns in exported data and questions to bring
        to the care team. Do not use it to decide doses or change pump settings on your own.
      </p>
    </div>
  )
}
