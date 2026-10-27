import { createFileRoute } from '@tanstack/react-router'

import { ChatPage } from '#/components/chat/chat-thread'
import { chatQuery, chatsQuery, peopleQuery, prefsQuery } from '#/lib/queries'

export const Route = createFileRoute('/ask/$threadId')({
  loader: ({ context, params }) => {
    const qc = context.queryClient
    return Promise.all([
      qc.ensureQueryData(chatQuery(params.threadId)),
      qc.ensureQueryData(prefsQuery),
      qc.ensureQueryData(peopleQuery),
      qc.ensureQueryData(chatsQuery),
    ])
  },
  component: AskThreadRoute,
})

function AskThreadRoute() {
  const { threadId } = Route.useParams()
  return <ChatPage threadId={threadId} />
}
