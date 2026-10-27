# LLM agents for explaining CGM and pump data

Research notes, October 2026. Scope: whether and how to add an LLM agent (Claude via the Anthropic API) to a personal dashboard for a teenager with type 1 diabetes who uses a Tandem Control-IQ pump and a CGM, with 90 days of CSV data. The agent would read computed summaries, explain trends in plain language and draft questions for the care team.

Every factual claim below links to its source. Statements marked "Recommendation" are design advice from this review, not findings from a source.

## Short answer

- Published evaluations agree that LLMs make errors when they compute glucose statistics themselves, and do much better when deterministic code computes the numbers and the model only selects, explains and phrases them.
- No published study found in this review evaluated LLM interpretation of CGM data with adolescents as users. The pediatric evidence covers general type 1 diabetes questions, where pediatric endocrinologists found answers mostly accurate but with safety-relevant omissions.
- Commercial products that ship generative AI on CGM data (Dexcom Stelo, Abbott Libre Assist) state that the output is not medical advice and should not be used for treatment decisions.
- Software that recommends insulin therapy adjustments is a regulated device in the US (21 CFR 862.1358, Class II) and likely a high class under EU MDR Rule 11. Patient-facing software cannot use the US clinical decision support exclusion.
- Anthropic's usage policy treats recommending or adjusting a treatment dose as a high-risk use that needs a qualified human reviewer, and products used by minors have extra requirements.

## 1. Studies and products

### Academic evaluations of LLMs on CGM data

Healey et al., Scientific Reports, January 2025: GPT-4 in ChatGPT Plus with the "Data Analyst" plugin analysed 10 synthetic 14-day CGM traces from the simglucose (UVA/Padova based) simulator. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC11707017/

- Metric computation: 9 of 10 metric tasks were fully correct in all cases. Time above 180 mg/dL was wrong in four cases because the model excluded readings above 250 mg/dL, apparently because the prompt called 181 to 250 mg/dL "level 1".
- Narrative errors came mostly from misreading the task, for example averaging glucose over a window instead of finding the window with the highest average. One code error labelled normal glucose as prolonged hyperglycemia.
- Two clinician raters (adult and pediatric endocrinology fellows) scored safety 9.5 to 10 out of 10, but found three unsafe statements: one implied stable control despite persistent hyperglycemia, and two overstated hyperglycemia in a well-controlled patient in a way that could push toward overcorrection and hypoglycemia.
- Completeness was weaker (7.5 out of 10 for the main takeaway). The model sometimes missed brief nocturnal hypoglycemia, did not factor GMI or time in range into the main takeaway, and did not handle missing data.
- The authors conclude LLMs are not yet good enough to replace clinician input and suggest a clinician-verified first-pass summary.

Healey and Kohane, LLM-CGM benchmark, Pacific Symposium on Biocomputing 2025: Open benchmark of CGM question-answering tasks, tested with GPT-4 (gpt-4-0125-preview) in three setups: raw data as text in the prompt, single-shot code generation, and a LangChain agent with a Python tool. Source: https://psb.stanford.edu/psb-online/proceedings/psb25/healey.pdf

- Passing raw CGM values as text performed so poorly that the results were not shown. With 14 days of data the input was very large and the model "struggled to return even basic estimates"; one answer guessed a mean of "around the 180 to 220 range" from eyeballing the values.
- Code-based setups did well on simple metrics but poorly on anomaly detection and pattern recognition. Errors included returning standard deviation when coefficient of variation was asked, failed code that produced no answer, and wrong answers because the prompt did not say what day "today" was.
- The authors note that even without medical advice, an incorrect assessment of glucose data could lead a patient to dose insulin incorrectly.

Cui et al., "If Only My CGM Could Speak" (CGM-Agent), arXiv April 2026, ACL Findings 2026: The LLM only selects from 14 fixed analysis functions; raw CGM readings never enter the model context, and the model receives the question, reference dates and aggregated tool outputs. Sources: https://arxiv.org/abs/2604.17133 and https://arxiv.org/html/2604.17133

- Benchmark of 4,180 questions with ground truth from deterministic code. Value accuracy on synthetic questions was 0.94 for GPT-5-Mini, Gemini 3.0 Pro and Gemini 3.0 Flash, 0.81 for GPT-5.2, 0.75 for Llama-4 (17B) and 0.67 for Nemotron-Nano (9B).
- On real user questions, value accuracy for the top four models was 0.82 to 0.88, while Llama-4 fell to 0.44.
- Remaining errors came from intent ambiguity (picking a valid but different analysis) and temporal ambiguity (different boundaries for "afternoon"), not from arithmetic. Removing the input-processing step lowered accuracy and led to missing arguments and invented feature keys.
- A feasibility layer that rejects unanswerable questions had recall of 0.95 or higher for answerable questions and precision of 0.87 to 0.95, so some unanswerable questions still got through.
- Participants were adults; the paper's ethics section states 18 or older.

Guo et al., JMIR 2026 (also arXiv 2604.15124): A retrieval-grounded LLM conversational agent, designed to avoid individualized advice such as dose adjustment, was compared with answers written by six senior UK diabetes clinicians on 12 constructed CGM cases (288 responses, 864 ratings). The agent scored higher overall (4.37 vs 3.58 on a 5-point scale), with the largest gaps in empathy and actionability. Major safety concerns were rare and equal in both groups (3 each, 0.7%). The authors state the results do not support autonomous therapeutic decision-making or unsupervised real-world use. Sources: https://arxiv.org/abs/2604.15124 and DOI https://doi.org/10.2196/98519

DexBench, Cardei et al., arXiv September 2025: Patient-facing benchmark with 360,600 questions generated from about one month of CGM and behaviour logs from 15,000 people (type 1, type 2, prediabetes and wellness), scored on accuracy, groundedness, safety, clarity and actionability across eight LLMs. No single model led on all dimensions. Source: https://arxiv.org/abs/2510.00038v1

PHIA, Google Research (wearables, not CGM): An agent that combines code generation, a Python interpreter and search reached 84% accuracy on more than 4,000 objective numerical questions about sleep and fitness data and beat a code-generation baseline and a plain numerical-reasoning baseline. Sources: https://research.google/blog/advancing-personal-health-and-wellness-insights-with-ai/ and https://arxiv.org/abs/2406.06464v1

### Pediatric and adolescent evidence

This review found no study that evaluated an LLM interpreting CGM data for adolescent users. The closest evidence:

- Ongen et al., BMC Pediatrics 2025: Five pediatric endocrinologists rated answers from ChatGPT-3.5, ChatGPT-4, ChatGPT-4o, Gemini and Gemini Advanced to 20 common questions from children with type 1 diabetes and their parents. ChatGPT-4o scored highest (3.78 out of 5) and Gemini lowest (3.40); the difference was not significant. Source: https://doi.org/10.1186/s12887-025-05945-6
- Voiculescu et al., JMIR Diabetes 2025: A pediatric diabetes team at Montreal Children's Hospital reviewed ChatGPT (GPT-4) answers to family questions. Answers were mostly accurate and jargon-free, and most pointed back to the care team. Omissions included no mention of home ketone testing for hyperglycemia, no reference to ISPAD pediatric targets, and no mention that hypoglycemia treatment depends on the child's weight. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC12594437
- Tan et al., Digital Health 2026: Experts rated 26.8% (GPT-3.5) and 31.7% (GPT-4) of answers to pediatric questions as partly or completely incorrect, while 73.1% of 27 parents said they trusted the information. Not diabetes-specific, but relevant to how much a family will trust fluent output. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC12979900/
- Gera et al., Diabetes Technology and Therapeutics 2025: In 1,316 youth with type 1 diabetes (median age 14.6), about 9.6 days of CGM data gave a reliable assessment compared with 14 days, and 7 days could be enough for youth with TIR of 70% or more and CV below 36%. This sets a lower bound for comparison windows. Source: https://pubmed.ncbi.nlm.nih.gov/40662594/

### Commercial features

| Product | What the AI does | Model and safety statements | Source |
| --- | --- | --- | --- |
| Dexcom Stelo weekly insights (December 2024) | Personalized weekly summary of how meals, sleep and activity relate to glucose, with tips | Built on Google Vertex AI and Gemini. Reported as not giving medical advice; Dexcom used an FDA AI framework. Stelo is cleared for adults 18 and older not on insulin. | https://investors.dexcom.com/news/news-details/2024/Dexcom-Launches-the-First-Generative-AI-Platform-in-Glucose-Biosensing/default.aspx and https://www.nbclosangeles.com/news/business/money-report/dexcoms-over-the-counter-glucose-monitor-now-offers-users-an-ai-summary-of-how-sleep-meals-and-more-impact-sugar-levels/3584375 |
| Dexcom Smart Food Logging (July 2025, G7 and Stelo) | Identifies meal ingredients from a photo | Users still enter carbs manually in the G7 app | https://investors.dexcom.com/news/news-details/2025/Dexcom-Launches-Revolutionary-AI-Powered-Meal-Logging-Feature-Across-Glucose-Biosensing-Portfolio/default.aspx and https://www.dexcom.com/en-us/all-access/dexcom-cgm-explained/new-g7-app-features |
| Abbott Libre Assist (January 2026) | Rates the likely glucose impact of a meal photo and shows the measured effect afterwards | Footnote: generative AI "may not always be accurate" and "should not be used to make treatment decisions" | https://abbott.mediaroom.com/2026-01-05-Abbotts-new-Libre-Assist-app-feature-tackles-a-top-need-for-people-living-with-diabetes-in-the-moment-food-decisions |
| Gluroo Diabetes Copilot | Chatbot that answers glucose and carb questions with access to current glucose, targets, device type, active insulin and carbs | The product page names no model provider and shows no dosing disclaimer in its text | https://gluroo.com/ai/ |
| Medtronic Sugar.IQ (2016 to 2018) | IBM Watson pattern detection on glucose and insulin data; pre-LLM | | https://www.healthcareitnews.com/news/medtronic-introduces-ibm-watson-powered-sugariq-diabetes-app |
| Glooko | Acquired AI company xbird; no generative AI feature found in this search | | https://www.mobihealthnews.com/news/glooko-acquires-ai-enabled-diabetes-management-company-xbird |

Searches for LLM features from Tidepool, Sugarmate and current Medtronic (MiniMed) apps returned nothing. That is an absence of search results, not proof that no such feature exists.

### Failure modes seen across studies

| Failure mode | Where reported |
| --- | --- |
| Wrong numbers when the model reads raw values instead of running code | LLM-CGM benchmark (PSB 2025) |
| Wrong metric definition (TAR band, SD instead of CV) | Healey 2025; LLM-CGM benchmark |
| Misread task, for example average over a window instead of the window with the highest average | Healey 2025 |
| Omitted brief nocturnal hypoglycemia; main takeaway ignored TIR and GMI | Healey 2025 |
| Severity framing errors in both directions | Healey 2025 |
| No reference date, so "recent" and "today" fail | LLM-CGM benchmark |
| Ambiguous time windows such as "afternoon" | CGM-Agent 2026 |
| Invented tool arguments or feature keys | CGM-Agent 2026 |
| Missing pediatric safety steps (ketones, weight-based hypo treatment) | Voiculescu 2025 |
| Parents trust output that experts rate as partly wrong | Tan 2026 |

## 2. Architecture patterns supported by the evidence

Compute every metric deterministically: The LLM-CGM benchmark found that putting raw CGM values in the prompt failed even on basic means, while code-based setups did well on metrics. CGM-Agent removed computation from the model entirely and its residual errors were about intent and time windows, not arithmetic. PHIA likewise outperformed a plain numerical-reasoning baseline by running code. Sources: https://psb.stanford.edu/psb-online/proceedings/psb25/healey.pdf, https://arxiv.org/html/2604.17133, https://research.google/blog/advancing-personal-health-and-wellness-insights-with-ai/

Prefer a fixed tool library over free code generation: In the LLM-CGM benchmark, generated code often failed and produced no answer, and single-shot code could not recover. CGM-Agent's fixed function set avoided that class of error. Source: same as above.

Pass a compact structured summary, not raw readings: CGM-Agent sends the model only aggregated tool outputs such as TIR, wear time, day counts and excursion timestamps. Source: https://arxiv.org/html/2604.17133

State definitions, ranges and the reference date explicitly: Both Healey studies traced errors to undefined bands and a missing "today". Use the international consensus definitions: TIR 70 to 180 mg/dL (3.9 to 10.0 mmol/L), TBR level 1 54 to 69 mg/dL and level 2 below 54 mg/dL, TAR level 1 181 to 250 mg/dL and level 2 above 250 mg/dL, CV target 36% or lower, and at least 70% CGM wear. The same consensus notes that for people under 25 with an A1C goal of 7.5%, the TIR target is about 60%, so targets should come from the care team, not the model. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC6973648/

Constrain output with a schema: The Claude API supports JSON outputs through `output_config.format` and strict tool inputs with `strict: true`, using constrained decoding. The schema guarantee does not hold on a refusal or when `max_tokens` is hit, and numeric constraints such as `minimum` and `maximum` are not supported, so range checks must run in application code. Anthropic's docs also say not to put PHI in JSON schema definitions because compiled schemas are cached separately. Sources: https://platform.claude.com/docs/en/build-with-claude/structured-outputs and https://platform.claude.com/docs/en/manage-claude/api-and-data-retention

Ground every claim and allow "not enough data": Anthropic's guidance on reducing hallucinations recommends letting the model say it does not know, restricting it to provided information, and verifying each claim against a source and retracting unsupported claims. It also says these techniques reduce but do not eliminate hallucinations. Source: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

Scope out dosing advice in the design, not only in the prompt: The Guo et al. agent was built to avoid dose adjustments and regimen changes and was still positioned as an adjunct for education and consultation preparation. Source: https://doi.org/10.2196/98519

Keep a qualified human in the loop for anything treatment-related: Anthropic's usage policy lists recommending, starting, stopping or adjusting a treatment or medication, including dose, as high-risk, requires a qualified person to meaningfully review such a recommendation with authority to change it, and requires disclosure that AI was used. Source: https://www.anthropic.com/aup

Make completeness deterministic: Healey 2025 found the model omitted brief nocturnal lows. Recommendation: deterministic rules decide which findings must be mentioned (for example any level 2 low), and the validator rejects an output that drops one.

## 3. Regulatory and safety framing

### United States

- Insulin adjustment software is a classified device: 21 CFR 862.1358 defines an insulin therapy adjustment device as one that uses inputs such as CGM data to recommend insulin therapy adjustments. It is Class II with special controls covering clinical validation, user interpretation and dosing-error mitigation. FDA product codes under this regulation include QCC (pump therapy adjustment calculator for healthcare professionals) and QRX (CGM-informed insulin dose calculator). Sources: https://www.law.cornell.edu/cfr/text/21/862.1358, https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfTPLC/tplc.cfm?id=QCC, https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpcd/classification.cfm?id=QRX
- Patient-facing software cannot use the CDS exclusion: FDA states that software functions intended for patients or caregivers do not meet the non-device CDS criteria, because criterion 3 requires supporting a healthcare professional. FDA revised the CDS guidance in January 2026 (issued January 6, reissued January 29), with enforcement discretion for some single-recommendation tools, but that change applies to HCP-facing software. Sources: https://www.fda.gov/medical-devices/digital-health-center-excellence/step-6-software-function-intended-provide-clinical-decision-support, https://www.thefdalawblog.com/2026/01/a-busy-day-in-the-cdrh-neighborhood-updates-to-the-cds-and-general-wellness-guidance-documents/
- Self-management without treatment suggestions is low risk: FDA intends to exercise enforcement discretion for software that helps patients self-manage their disease "without providing specific treatment suggestions". FDA does actively oversee apps that act as the control centre for a glucose meter used by an insulin-dependent patient. Source: https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications
- The general wellness route does not fit: The 2026 general wellness guidance allows some non-invasive glucose estimates as wellness products only when outputs are solely for wellness, with no disease claims and no prompts for specific clinical action. A type 1 diabetes tool makes disease claims by nature. Source: https://www.thefdalawblog.com/2026/01/a-busy-day-in-the-cdrh-neighborhood-updates-to-the-cds-and-general-wellness-guidance-documents/

### European Union

- MDR Rule 11: Software that provides information used for diagnostic or therapeutic decisions is Class IIa, IIb if a decision could cause serious deterioration, and III if it could cause death or irreversible deterioration. Johner Institute's analysis expects software that calculates drug doses to fall in Class III. Source: https://blog.johner-institute.com/regulatory-affairs/mdr-rule-11/
- MDCG 2019-11 Rev.1 (June 2025) kept the qualification logic and Rule 11 structure and added examples. Source: https://gmpinsiders.com/mdcg-2019-11-rev1-mdr-ivdr/
- Market placement: MDR obligations attach to making a device available on the market, defined as supply in the course of a commercial activity, paid or free. Source (secondary, check against EUR-Lex): https://medenvoyglobal.com/regulatory-compliance-and-the-meaning-of-placing-on-the-market/. This review found no authoritative guidance on a tool a family builds for its own use and never supplies to anyone else. Treat that as an open legal question, and design as if the tool should stay clearly outside "therapeutic decision" software.

### Wording that keeps the tool on the safe side

Abbott tells users its generative AI "should not be used to make treatment decisions", Dexcom states its Stelo AI reports do not give medical advice, and the Guo et al. agent avoided recommending dose adjustments or regimen changes. Sources: links in section 1. Recommendation, based on those examples and the FDA wording above:

| Avoid | Use instead |
| --- | --- |
| "Increase your breakfast carb ratio to 1:8." | "Breakfast highs showed up on 9 of the last 14 days. This could be worth asking your diabetes team about." |
| "Your basal is too low overnight." | "Overnight readings rose after 03:00 on most nights this month. Your team can tell you whether that matters." |
| "Pre-bolus 15 minutes earlier." | "Question for the team: does the timing of my meal boluses explain the after-lunch peaks?" |
| "You should change your correction factor." | Never generated. Settings questions go to the care team list without a proposed value. |
| "Your control is bad." | "Time in range was 58% this period, compared with 64% last period." |

Rules behind the table: describe what happened with numbers from tools, never propose a setting value or direction of change, frame anything actionable as a question for the care team, and state that the AI produced the text.

## 4. Privacy for a minor's health data

- Legal frame (EU): GDPR Article 9(1) lists data concerning health as a special category. Article 2(2)(c) excludes processing by a natural person in a purely personal or household activity. Sources: https://gdpr-info.eu/art-9-gdpr/, https://gdpr-info.eu/art-2-gdpr/
- Anthropic API retention: The privacy centre says API inputs and outputs are deleted from the backend within 30 days, with exceptions for zero data retention agreements, usage policy enforcement and legal requirements; content flagged by trust and safety systems may be kept up to 2 years. The developer docs say retained data is not used for training without express permission, describe ZDR as available through the sales team, and note that some newer "Covered Models" require 30-day retention and are not available under ZDR. A HIPAA-ready configuration with a BAA exists for organisations handling PHI. Sources: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data, https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Minors: Anthropic defines a minor as under 18. Organisations whose products let minors interact with API features must add age-appropriate safeguards, comply with child privacy law, state that compliance publicly, and tell users they are talking to an AI. Sources: https://www.anthropic.com/aup, https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors
- Send aggregates only: CGM-Agent keeps raw readings on the device and sends only tool outputs to the model. Source: https://arxiv.org/html/2604.17133. Recommendation: send no name, birth date, device serial numbers or exact calendar dates; use day offsets ("day 1 to 14") and aggregated values.
- On-device models: Apple's Foundation Models framework runs an on-device model with tool calling and guided generation into typed structures, and Apple points to server models when more reasoning or context is needed. Ollama supports JSON-schema constrained output for locally run models. Sources: https://developer.apple.com/documentation/foundationmodels, https://registry.ollama.ai/blog/structured-outputs. CGM-Agent's results suggest a cost: the open-weight models it tested scored lower (Llama-4 17B at 0.75 synthetic and 0.44 real-world value accuracy).

## 5. Recommended design for this project

All of this section is recommendation, built on the findings above.

### What is deterministic

- CSV parsing of the Tandem export, unit handling and time zone normalisation.
- Data quality: CGM wear percentage, gaps, sensor warm-up periods, days with fewer than 70% of readings. Comparison windows of at least 10 days, following Gera et al.
- Consensus metrics per period: mean glucose, GMI, CV, TIR, TBR level 1 and 2, TAR level 1 and 2, all with fixed definitions.
- Time-of-day profiles (percentiles per hour), and fixed day-part boundaries stored in config (for example overnight 00:00 to 06:00) so "afternoon" means one thing.
- Event detection: lows and highs with start, duration and nadir or peak; post-meal excursions linked to logged carbs and boluses; Control-IQ activity summaries from the pump data.
- Rule findings with a severity level: for example "level 2 lows on 3 or more nights in 14 days" or "TIR dropped more than 5 points between periods". Each finding has an id and lists the fact ids that support it.
- Targets come from a config file filled in with the care team, never from the model.

### What the LLM does

- Picks the two or three most relevant rule findings and explains them in plain, teen-friendly language.
- Compares the current period with the previous one in words.
- Drafts questions for the care team, each tied to a finding.
- Answers follow-up questions from the teen or parent by calling tools, and says when the data cannot answer.
- It never computes a number, sets a target or proposes a setting value.

### Agent tools

All tools are read-only, take explicit ISO date ranges or day offsets, and return values with a stable `fact_id`.

| Tool | Returns |
| --- | --- |
| `get_period_summary(start, end)` | Consensus metrics, wear time, data quality flags |
| `compare_periods(a_start, a_end, b_start, b_end)` | Metric deltas with fact ids |
| `get_daypart_profile(start, end, daypart)` | Percentiles and TIR, TBR, TAR for a configured day part |
| `list_events(start, end, type)` | Lows, highs, meal excursions, with ids |
| `get_event_detail(event_id)` | Timeline around one event: glucose, carbs, bolus, Control-IQ actions |
| `get_rule_findings(start, end)` | Deterministic findings with severity and supporting fact ids |
| `get_targets()` | Care-team targets from config |
| `get_data_quality(start, end)` | Gaps, wear percentage, warm-up periods |
| `get_glossary(term)` | Fixed, reviewed explanations of terms like TIR or GMI |

Pump settings (basal profile, carb ratio, correction factor) are not exposed as a tool. If the model cannot read them, it cannot propose new values for them.

### Guardrails

1. Structured output via `output_config.format`, schema below. No PHI in the schema itself.
2. Number grounding: application code extracts every number in every text field and checks that it matches a value in the cited `fact_ids` (after rounding). Any mismatch rejects the output.
3. Required coverage: every finding with severity "must_mention" (for example any level 2 low) must appear in `explanations`, or the output is rejected.
4. Dosing filter: a deterministic check rejects text that combines setting words (basal, ratio, correction factor, bolus, units) with change verbs (increase, decrease, change, lower, raise, adjust) or a proposed value. A teen's question that asks for a dose gets a fixed reply pointing to the care team and the pump's own bolus calculator, without calling the model.
5. Urgent states are out of scope: the dashboard is retrospective. Real-time alerts stay with the CGM and pump apps. The system prompt and UI say so.
6. Parent review: the drafted care-team questions go into a parent review queue before anyone sends them. Explanations shown to the teen carry an "AI-written summary, check with your team" label.
7. Evaluation before use: a fixed set of 50 or more periods from the family's own 90 days, with expected findings, run on every prompt or model change. Track grounding failures, missed must-mention findings and dosing-filter hits.
8. Fallback: if validation fails twice, show the deterministic findings as plain text with no LLM output.

### Output schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["period", "headline", "explanations", "care_team_questions", "data_quality_note"],
  "properties": {
    "period": {"type": "string"},
    "headline": {"type": "string"},
    "explanations": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["finding_id", "text", "fact_ids"],
        "properties": {
          "finding_id": {"type": "string"},
          "text": {"type": "string"},
          "fact_ids": {"type": "array", "items": {"type": "string"}}
        }
      }
    },
    "care_team_questions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["question", "finding_id", "fact_ids"],
        "properties": {
          "question": {"type": "string"},
          "finding_id": {"type": "string"},
          "fact_ids": {"type": "array", "items": {"type": "string"}}
        }
      }
    },
    "data_quality_note": {"type": "string"},
    "not_enough_data": {"type": "boolean"}
  }
}
```

### Example of a good output

The numbers are illustrative, not from the real data.

```json
{
  "period": "Last 14 days compared with the 14 days before",
  "headline": "Time in range went from 61% to 66%. Most of the out-of-range time is after breakfast.",
  "explanations": [
    {
      "finding_id": "F-tir-delta",
      "text": "You spent 66% of the time between 3.9 and 10.0 mmol/L, up from 61%. That is about 1 hour 12 minutes more per day in range.",
      "fact_ids": ["m.tir.cur", "m.tir.prev", "m.tir.delta_minutes"]
    },
    {
      "finding_id": "F-breakfast-high",
      "text": "On 9 of the 14 days, glucose went above 13.9 mmol/L within 2 hours of breakfast. Lunch and dinner went above that level on 2 and 3 days.",
      "fact_ids": ["e.bkf.high.count", "e.lunch.high.count", "e.dinner.high.count"]
    },
    {
      "finding_id": "F-night-low",
      "text": "There were 2 nights with a reading below 3.0 mmol/L, both between 02:00 and 04:00. Time below 3.9 mmol/L overall was 3%.",
      "fact_ids": ["e.night.l2.count", "e.night.l2.window", "m.tbr.cur"]
    }
  ],
  "care_team_questions": [
    {
      "question": "Breakfast is when most of my highs happen (9 of 14 days). What could be causing that, and is it something to look at together?",
      "finding_id": "F-breakfast-high",
      "fact_ids": ["e.bkf.high.count"]
    },
    {
      "question": "I had 2 nights with lows below 3.0 mmol/L around 02:00 to 04:00. Is there anything about evenings or overnight we should check?",
      "finding_id": "F-night-low",
      "fact_ids": ["e.night.l2.count", "e.night.l2.window"]
    }
  ],
  "data_quality_note": "The sensor was active 94% of the time, which is enough for these numbers.",
  "not_enough_data": false
}
```

What makes it good: every number maps to a fact id, the night lows appear even though the headline is positive, nothing proposes a setting or a direction of change, and the questions are written in the teen's voice for the parent to review before they reach the care team.

## Open questions

- How a private, non-distributed family tool is treated under MDR and FDA rules. No authoritative source found.
- Whether to use Anthropic ZDR or the HIPAA-ready configuration for a personal account, and which current models qualify. Check the eligibility table before choosing a model.
- No adolescent-user evaluation of LLM CGM explanations exists in the sources found, so readability and trust for teenagers must be tested with the people using the app.
