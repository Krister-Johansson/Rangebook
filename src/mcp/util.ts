import { loadDataset } from '#/server/dataset'

export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

export const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
})

export async function requireData() {
  const ds = await loadDataset()
  if (!ds) {
    throw new Error(
      'No data imported yet. Import the export zip on http://localhost:3000/import first.',
    )
  }
  return ds
}
