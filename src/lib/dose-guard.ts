// Questions saved for clinic must not carry doses or setting values: a number
// with an insulin or ratio unit, or a 1:x ratio. Used by the chat tool, the
// save server function and the chat's save form.
const DOSE_VALUE = /\b\d+(?:[.,]\d+)?\s*(?:u\b|units?\b|u\/h\b|g\/u\b|mmol\/l per u\b)|\b1\s*:\s*\d+/i

export function hasDoseValue(text: string) {
  return DOSE_VALUE.test(text)
}

export const DOSE_VALUE_MESSAGE =
  'Questions for clinic leave out numbers for insulin or ratios. Ask it without them, and the care team will look at the values with you.'
