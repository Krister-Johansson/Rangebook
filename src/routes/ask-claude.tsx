import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Bot, Check, Copy, LifeBuoy, ListChecks, MessageSquareText, ShieldAlert, Users } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { SectionCard } from '#/components/home/section-card'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { getMcpSetup } from '#/server/mcp-setup'

const setupQuery = queryOptions({
  queryKey: ['mcp-setup'],
  queryFn: () => getMcpSetup(),
})

export const Route = createFileRoute('/ask-claude')({
  validateSearch: z.object({ app: z.enum(['desktop', 'code']).catch('desktop') }),
  loader: ({ context }) => context.queryClient.ensureQueryData(setupQuery),
  component: AskClaudePage,
})

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 pr-12 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute top-1.5 right-1.5 size-8"
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="text-sm font-semibold">{title}</div>
        {children}
      </div>
    </li>
  )
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)
const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
)

function AskClaudePage() {
  const { data } = useSuspenseQuery(setupQuery)
  const { app } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const windows = data.platform === 'win32'
  const configPath = windows
    ? '%APPDATA%\\Claude\\claude_desktop_config.json'
    : '~/Library/Application Support/Claude/claude_desktop_config.json'
  const logPath = windows ? '%APPDATA%\\Claude\\logs' : '~/Library/Logs/Claude'
  const command = data.pnpmPath ?? 'pnpm'
  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        rangebook: {
          command,
          args: ['--silent', '--dir', data.projectDir, 'mcp'],
          env: { DATABASE_URL: data.databaseUrl, PATH: data.serverPath },
        },
      },
    },
    null,
    2,
  )
  const quote = (s: string) => (/[\s"'$]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
  const codeAdd = `claude mcp add --env DATABASE_URL=${quote(data.databaseUrl)} --transport stdio --scope user rangebook -- ${quote(command)} --silent --dir ${quote(data.projectDir)} mcp`
  const names = data.people.map((p) => p.name)
  const example = names[0] ?? 'Sam'

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-[22px] leading-tight font-bold tracking-tight">Ask Claude about the data</h1>
        <p className="text-sm text-muted-foreground">
          Rangebook includes an MCP server. Once it is connected, Claude can read the same numbers and
          patterns as this app, explain them and help write questions for the care team. The server
          runs on this computer and reads the local database; the app itself does not have to be open.
        </p>
      </div>

      <Alert>
        <ShieldAlert />
        <AlertTitle>What leaves this computer</AlertTitle>
        <AlertDescription>
          The server runs here, but whatever a tool returns becomes part of the conversation with Claude
          and is sent to Anthropic, the same as anything you type. Most tools return summaries; the day
          tools return one day's readings. Claude is told never to suggest doses or setting values.
        </AlertDescription>
      </Alert>

      <SectionCard title="Before you start" icon={ListChecks}>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            Postgres must be running: <C>docker compose up -d</C> in the Rangebook folder.
          </li>
          <li>
            At least one person needs imported data.{' '}
            {data.people.some((p) => p.hasData) ? (
              'That is already the case.'
            ) : (
              <Link to="/import" className="underline underline-offset-2">
                Import an export first.
              </Link>
            )}
          </li>
          <li>
            The setup below uses this folder: <C>{data.projectDir}</C>
          </li>
        </ul>
      </SectionCard>

      <Tabs
        value={app}
        onValueChange={(v) => navigate({ search: { app: v as 'desktop' | 'code' }, replace: true })}
      >
        <TabsList>
          <TabsTrigger value="desktop">Claude Desktop</TabsTrigger>
          <TabsTrigger value="code">Claude Code</TabsTrigger>
        </TabsList>

        <TabsContent value="desktop" className="mt-3">
          <SectionCard
            title="Connect Claude Desktop"
            icon={Bot}
            description="Claude Desktop also shows the charts and pattern cards from the show tools right in the chat."
          >
            <ol className="flex flex-col gap-5">
              <Step n={1} title="Open the config file">
                <P>
                  In Claude Desktop, open Settings, then Developer, then Edit Config. Or open the file
                  directly:
                </P>
                <CodeBlock code={configPath} label="config file path" />
              </Step>
              <Step n={2} title="Add the Rangebook server">
                <P>
                  Paste this into the file. If it already has an <C>mcpServers</C> section, add only the{' '}
                  <C>rangebook</C> entry inside it.
                </P>
                <CodeBlock code={desktopConfig} label="Claude Desktop config" />
                <P>
                  Claude Desktop starts servers with a short <C>PATH</C>, so the config lists the folders
                  of node and pnpm on this computer. If you upgrade or move node, open this page again
                  and copy the new config.
                </P>
                {data.pnpmPath ? null : (
                  <P>
                    pnpm was not found on this computer's path, so the config uses plain <C>pnpm</C>. If
                    Claude Desktop cannot start the server, replace it with the full path from{' '}
                    <C>{windows ? 'where pnpm' : 'which pnpm'}</C>.
                  </P>
                )}
              </Step>
              <Step n={3} title="Restart Claude Desktop">
                <P>Quit it completely and open it again. The server starts when Claude Desktop starts.</P>
              </Step>
              <Step n={4} title="Check that it works">
                <P>Start a new chat and ask: "Which people are in Rangebook?"</P>
              </Step>
            </ol>
          </SectionCard>
        </TabsContent>

        <TabsContent value="code" className="mt-3">
          <SectionCard
            title="Connect Claude Code"
            icon={Bot}
            description="Claude Code gets the same tools. In a terminal, the show tools return the data as text."
          >
            <ol className="flex flex-col gap-5">
              <Step n={1} title="Inside the Rangebook folder">
                <P>
                  The folder already has a <C>.mcp.json</C> that registers the server. Start Claude Code
                  here and approve the <C>rangebook</C> server when it asks.
                </P>
                <CodeBlock code={`cd ${quote(data.projectDir)}\nclaude`} label="commands" />
              </Step>
              <Step n={2} title="From any folder">
                <P>
                  To use Rangebook from other folders too, add it for your user. Everything after{' '}
                  <C>--</C> is the command that starts the server.
                </P>
                <CodeBlock code={codeAdd} label="claude mcp add command" />
                <P>
                  Check it with <C>claude mcp list</C>.
                </P>
              </Step>
            </ol>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <SectionCard title="More than one person" icon={Users}>
        <P>
          When more than one person is stored, Claude asks the server which people there are and names
          the person in every call. Say who you mean, for example "How was {example}'s week?".
        </P>
        {names.length > 1 ? (
          <P>
            To fix the server to one person, add <C>"RANGEBOOK_PERSON": "{example}"</C> next to{' '}
            <C>DATABASE_URL</C> in <C>env</C>. People now: {names.join(', ')}.
          </P>
        ) : null}
      </SectionCard>

      <SectionCard title="Things to try" icon={MessageSquareText}>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>"Give me a weekly review for {example}." (the weekly_review prompt does the same)</li>
          <li>"Show this week." Claude Desktop draws the week next to the week before.</li>
          <li>"Which patterns should we bring up at the next clinic visit?"</li>
          <li>"What happened on the day with the most lows last week?"</li>
          <li>"Save that as a question for clinic." It then shows up on the Patterns page.</li>
        </ul>
      </SectionCard>

      <SectionCard title="If it does not work" icon={LifeBuoy}>
        <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            "No people stored" or "No data imported": add a person and import an export in this app.
          </li>
          <li>
            Connection errors: check that Postgres runs (<C>docker compose ps</C>) and that{' '}
            <C>DATABASE_URL</C> matches <C>.env.local</C>.
          </li>
          <li>
            Claude Desktop logs are in <C>{logPath}</C>. <C>mcp.log</C> shows connection failures and{' '}
            <C>mcp-server-rangebook.log</C> shows what the server printed.
          </li>
          <li>
            Test the server on its own with <C>pnpm mcp</C> in the Rangebook folder. It waits for input
            without printing anything; stop it with Ctrl+C.
          </li>
        </ul>
      </SectionCard>
    </div>
  )
}
