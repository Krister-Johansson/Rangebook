import { strFromU8, unzipSync } from 'fflate'

import { parseExportCsv } from './parse'
import type { ParsedFile } from './parse'

export interface UnpackResult {
  files: ParsedFile[]
  ignored: string[]
}

function isJunk(path: string) {
  return path.startsWith('__MACOSX/') || path.endsWith('.DS_Store')
}

// Accepts one export zip or loose CSV files and returns every recognised CSV.
export function unpackUploads(
  uploads: { name: string; bytes: Uint8Array }[],
): UnpackResult {
  const files: ParsedFile[] = []
  const ignored: string[] = []

  const addCsv = (path: string, bytes: Uint8Array) => {
    const parsed = parseExportCsv(path, strFromU8(bytes))
    if (parsed) files.push(parsed)
    else ignored.push(path)
  }

  for (const { name, bytes } of uploads) {
    if (name.toLowerCase().endsWith('.zip')) {
      const entries = unzipSync(bytes, { filter: (f) => !isJunk(f.name) })
      for (const [path, data] of Object.entries(entries)) {
        if (path.endsWith('/')) continue
        if (path.toLowerCase().endsWith('.zip')) {
          // Some exports nest a zip inside the download.
          const inner = unpackUploads([{ name: path, bytes: data }])
          files.push(...inner.files)
          ignored.push(...inner.ignored)
        } else if (path.toLowerCase().endsWith('.csv')) {
          addCsv(path, data)
        } else {
          ignored.push(path)
        }
      }
    } else if (name.toLowerCase().endsWith('.csv')) {
      addCsv(name, bytes)
    } else {
      ignored.push(name)
    }
  }

  return { files, ignored }
}
