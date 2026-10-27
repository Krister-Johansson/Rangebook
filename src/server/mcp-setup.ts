import { createServerFn } from '@tanstack/react-start'

import { listPeopleRows } from './people-store'

/**
 * Values for the MCP setup page, read on the machine that runs the app, so the
 * config shown there works when pasted as is.
 */
export const getMcpSetup = createServerFn({ method: 'GET' }).handler(async () => {
  const { execFileSync } = await import('node:child_process')
  const path = await import('node:path')
  let pnpmPath: string | null = null
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which'
    pnpmPath = execFileSync(finder, ['pnpm'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim() || null
  } catch {
    pnpmPath = null
  }
  const people = await listPeopleRows()
  // Claude Desktop starts servers with a short PATH that usually lacks node
  // (for example under nvm), so the config carries the directories it needs.
  const dirs = [path.dirname(process.execPath), pnpmPath ? path.dirname(pnpmPath) : null]
  const system = process.platform === 'win32' ? ['C:\\Windows\\System32'] : ['/usr/bin', '/bin']
  const serverPath = [...new Set([...dirs.filter((d): d is string => !!d), ...system])].join(path.delimiter)
  return {
    serverPath,
    projectDir: process.cwd(),
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://cgm:cgm@localhost:5433/cgm',
    pnpmPath,
    platform: process.platform,
    people: people.map((p) => ({ name: p.name, hasData: p.imports > 0 })),
  }
})
