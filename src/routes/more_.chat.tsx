import { createFileRoute } from '@tanstack/react-router'

import { ChatSettings } from '#/components/chat/chat-settings'
import { chatsQuery, peopleQuery, prefsQuery } from '#/lib/queries'

export const Route = createFileRoute('/more_/chat')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(prefsQuery),
      context.queryClient.ensureQueryData(peopleQuery),
      context.queryClient.ensureQueryData(chatsQuery),
    ]),
  component: ChatSettings,
})
