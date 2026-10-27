// Text the MCP server hands to Claude: standing instructions, a fixed
// glossary and prompt templates. Wording follows docs/research/llm-agents.md.

export const SERVER_INSTRUCTIONS = `This server reads a teenager's own CGM and Tandem t:slim X2 (Control-IQ) pump data from a local database. Glucose is in mmol/L.

How to use it:
- Get every number from a tool. Do not calculate, estimate or round numbers in ways that change them, and do not invent values the tools did not return.
- Start with get_overview to see the data range and quality. Check sensor wear before drawing conclusions: under 70% wear means the numbers may not represent the period.
- get_patterns returns rule-based findings with evidence counts and a question for the care team. Lows come first: clinics review time below range before anything else.
- The data has no flag for Control-IQ automatic boluses. They are estimated, so say so when you use them.
- Pump settings (basal rates, carb ratios, correction factor, targets) are not in this data.

Safety rules:
- Never suggest a dose, a new setting value or a direction of change (for example "raise the lunch carb ratio"). Describe what happened, how often, and which setting areas the care team might look at, then frame it as a question for the care team. The care team decides every change.
- This data is retrospective. For anything happening right now (a low, ketones, feeling unwell) point to the pump and CGM alerts, the care plan and the care team or emergency services.
- Write for a teenager: short sentences, plain words, no blame. Say "above range" and "below range", never "good" or "bad" numbers.
- Mention level 2 lows (below 3.0) whenever they appear in the period you discuss.
- Questions to bring to clinic can be saved with save_question_for_clinic, but only when the teen or a parent asks for it.`

export const GLOSSARY: Record<string, string> = {
  'time in range':
    'Share of CGM readings between 3.9 and 10.0 mmol/L. The international consensus target is over 70%. Each 1% is about 15 minutes a day.',
  'time below range':
    'Share of readings below 3.9 mmol/L. Target under 4%. Level 2 (below 3.0) target under 1%. Clinics look at this first.',
  'time above range':
    'Share of readings above 10.0 mmol/L. Target under 25%. Level 2 (above 13.9) target under 5%.',
  'time in tight range':
    'Share of readings between 3.9 and 7.8 mmol/L. A newer measure; ISPAD 2024 suggests over 50% as an emerging goal.',
  gmi: 'Glucose management indicator. An estimate of HbA1c from the average CGM glucose: GMI (%) = 3.31 + 0.02392 x average in mg/dL. It can differ from a lab HbA1c.',
  cv: 'Coefficient of variation: how much glucose swings around its average. 36% or less is the usual target. Higher values go with more lows.',
  'sensor wear':
    'Share of the period with CGM readings. At least 70% over 14 days is needed for the numbers to represent the period.',
  agp: 'Ambulatory glucose profile: all days laid on top of each other by time of day. The line is the median; the bands show where most readings fall.',
  'low episode':
    'At least 15 minutes (3 readings) below 3.9 mmol/L. It ends after 15 minutes back above 3.9.',
  'control-iq':
    "Tandem's automated insulin delivery. It adjusts basal insulin every 5 minutes from the CGM prediction and can give automatic correction boluses of 60% of a calculated correction, at most once an hour and not during Sleep Activity.",
  'automatic correction':
    'A correction bolus given by Control-IQ, not by the person. The export does not mark these, so this app estimates them: no carbs, a BG value and no carb ratio on the bolus row.',
  'sensor limit':
    'The CGM shows HI above 22.2 and LO below 2.2 mmol/L. The export writes these as 111.1 and 0.1; this app stores them as 22.2 and 2.2 and flags them.',
}

export function weeklyReviewPrompt() {
  return `Give me a short review of my last week of glucose data.

1. Call get_overview, then compare_periods for the last 7 days against the 7 days before.
2. Call get_patterns.
3. Write it for me (I am 15): one headline sentence, what went well, then the two or three patterns that matter most, lows first. Use only numbers the tools returned.
4. End with one or two questions I could bring to my care team. Do not suggest doses or setting changes.

If the data has gaps or sensor wear is under 70%, say that first.`
}

export function clinicPrepPrompt(days: number) {
  return `Help me prepare for my next diabetes clinic visit, using the last ${days} days.

1. Call get_overview, get_patterns with days=${days}, get_meal_responses with days=${days} and get_system_check with days=${days}.
2. Call list_saved_questions to see what I already saved.
3. Draft a short list (at most five) of questions for my care team, each tied to a pattern and its evidence (counts and time windows from the tools). Lows first.
4. Show the list to me and my parent for review. Only save a question with save_question_for_clinic if we ask you to.

Never suggest doses, setting values or which way a setting should change. The care team decides.`
}

export function explainDayPrompt(date: string) {
  return `Explain what happened on ${date} in my glucose data.

Call get_day with date=${date}. Walk through the day in order: overnight, meals and boluses, any lows or highs, pump stops, alarms and sensor gaps. Use only what the tool returned. Keep it short and friendly, and do not suggest doses or setting changes. If something looks worth asking my care team about, phrase it as a question.`
}
