# Clinical rules for CGM and Control-IQ data review

Research date: 2026-10-27. Scope: a personal dashboard for a teenager with type 1 diabetes on a Tandem t:slim X2 pump with Control-IQ and a CGM reporting in mmol/L, using 90 days of CGM, bolus, basal and alarm data.

The dashboard turns these rules into observations and questions for the diabetes care team. It does not change pump settings and does not give dosing instructions. Where a source gives a step size (for example "10-20%"), this document records it so the team can see what the source says. The dashboard should show it as context for a question to the clinic, not as an instruction.

Every number below carries a source tag such as [S1]. The source list is at the end. Items marked "Derived" are project design choices or inferences that no source states directly. They are labelled so a developer can tell them apart from sourced rules.

## 1. Units and conversions

The consensus documents give thresholds in both units. This document uses mmol/L first. The paired values used by the sources are:

| mg/dL | mmol/L | Used for |
|---|---|---|
| 54 | 3.0 | Level 2 low [S1] |
| 70 | 3.9 | Level 1 low, lower bound of TIR [S1] |
| 110 | 6.1 | Control-IQ automatic correction target [S15] |
| 112.5 | 6.25 | Control-IQ basal decrease threshold [S15] |
| 140 | 7.8 | Upper bound of time in tight range [S7] |
| 160 | 8.9 | Control-IQ basal increase threshold [S15] |
| 180 | 10.0 | Upper bound of TIR, automatic correction trigger [S1] [S15] |
| 250 | 13.9 | Level 2 high [S1] |
| 300 | 16.7 | Infusion set failure check [S13] |

Glucose differences convert the same way: 30 mg/dL is 1.7 mmol/L [S24], 60 mg/dL is 3.3 mmol/L [S21], 20 mg/dL is 1.1 mmol/L [S25].

## 2. CGM metrics and targets

### 2.1 Target table

| Metric | Definition | Target | Source |
|---|---|---|---|
| Sensor data sufficiency | Days of wear and percent of possible readings | 14 days with at least 70% of data | [S1] |
| TIR | % time 3.9-10.0 mmol/L | >70% | [S1] [S2] [S3] |
| TBR level 1 | % time <3.9 mmol/L (includes level 2) | <4% | [S1] [S2] [S3] |
| TBR level 2 | % time <3.0 mmol/L | <1% | [S1] [S2] [S3] |
| TAR level 1 | % time >10.0 mmol/L (includes level 2) | <25% | [S1] [S2] |
| TAR level 2 | % time >13.9 mmol/L | <5% | [S1] [S2] |
| CV | SD / mean x 100 | <=36% | [S1] |
| TITR | % time 3.9-7.8 mmol/L | >50% (emerging metric, ISPAD evidence grade C) | [S2] [S7] |
| GMI | Formula in 2.2 | No numeric GMI target; ISPAD HbA1c target is <=6.5% (48 mmol/mol) when CGM and AID are available, otherwise <=7.0% (53 mmol/mol) | [S2] |
| GRI | Formula in 2.3 | No target; lower is better | [S5] |

Notes for implementation:

- The 2019 consensus reports time at 3.0-3.8 mmol/L and time <3.0 mmol/L as separate bands, and time at 10.1-13.9 and >13.9 mmol/L as separate bands [S1]. The "TBR <4%" target in ISPAD 2024 is time below 3.9 mmol/L and the "<1%" target is time below 3.0 mmol/L [S2].
- The 2019 consensus states that each 5% increase in TIR is associated with clinically significant benefit [S1]. A dashboard can report TIR change in 5-point steps.
- The 2019 consensus says that if the HbA1c goal for people under 25 is 7.5%, the TIR target is about 60% [S1]. ISPAD 2024 says TIR may need to exceed 80%, and TITR may need to exceed 55%, to reach HbA1c <=6.5% [S2].
- TITR range: ISPAD 2024 writes it as "3.9-8 mmol/L or 70-144 mg/dL" [S2]. Sundberg et al. [S7], Gehrmann et al. [S9] and the Hossmann menstrual-cycle study [S34] use 3.9-7.8 mmol/L (70-140 mg/dL). The dashboard should use 3.9-7.8 mmol/L and record the ISPAD wording as a known discrepancy.
- ADA Standards of Care 2026, recommendation 6.3b sets TIR >70% for many nonpregnant adults and recommendation 6.3c sets time <3.9 mmol/L <4% and time <3.0 mmol/L <1% [S3]. The primary ADA 2026 Section 6 and Section 14 (children and adolescents) pages returned HTTP 403 during this research, so the pediatric wording of the 2026 Standards was not verified. The 2025 Section 6 is indexed at [S4] but its full text was not read.

### 2.2 GMI

GMI (%) = 3.31 + 0.02392 x mean glucose (mg/dL). With mean glucose in mmol/L: GMI (%) = 3.31 + 0.43056 x mean glucose, or GMI (mmol/mol) = 12.71 + 4.70587 x mean glucose [S6]. The formula was derived from Dexcom sensor data, and GMI needs at least 14 days with at least 70% wear [S6]. ISPAD 2024 says CGM-derived GMI "can be considered a standalone method for evaluating glycemic outcomes" (grade C) [S2].

### 2.3 Glycemia Risk Index (GRI)

Inputs are percentages of time [S5]:

- VLow: <3.0 mmol/L (<54 mg/dL)
- Low: 3.0 to <3.9 mmol/L (54 to <70 mg/dL)
- High: >10.0 to 13.9 mmol/L (>180 to 250 mg/dL)
- VHigh: >13.9 mmol/L (>250 mg/dL)

Formulas [S5]:

- Hypoglycemia component = VLow + 0.8 x Low
- Hyperglycemia component = VHigh + 0.5 x High
- GRI = 3.0 x hypo component + 1.6 x hyper component, which equals 3.0 x VLow + 2.4 x Low + 1.6 x VHigh + 0.8 x High
- If the result exceeds 100, GRI is capped at 100.
- Worked example from the paper: VLow 5%, Low 10%, VHigh 15%, High 20% gives GRI 79.

Zones A to E are quintiles of the clinician-rated reference set, from 0-20th percentile (A, best) to 81st-100th percentile (E, worst) [S5]. The paper's text does not give numeric GRI cutoffs for the zones; they appear only as diagonal lines on the GRI grid. The dashboard should not label zones with numeric cutoffs until someone checks the figure.

### 2.4 Hypoglycemia event definition

The 2023 international consensus for clinical trials starts a CGM hypoglycemia event when readings stay below the threshold (3.9 or 3.0 mmol/L) for at least 15 consecutive minutes, and ends it when readings stay at or above the threshold for 15 consecutive minutes [S8]. This came from trial statistical plans that quote the consensus and from the Hypo-METRICS paper, not from the consensus text itself. The 2019 consensus lists "episodes 15 min" among the 2017 metrics [S1].

### 2.5 Data review cadence

Gehrmann et al. ran scheduled remote CGM reviews in children every 14 days and flagged [S9]:

- Major: TIR <50%, a ">10% reduction in TIR over 2 weeks", TBR >4%, sensor wear <75%
- Minor: TIR 51-69%

The paper does not say whether "10% reduction" is relative or in percentage points. Derived: the dashboard should compute both and use percentage points for display.

## 3. Structured review order

The sources agree on the order: check data quality, fix lows first, then overnight and fasting glucose, then meals.

| Method | Order | Source |
|---|---|---|
| DATAA (Isaacs) | Download data, Assess safety, Time in range, Areas to improve, Action plan | [S11] |
| 3-step approach (Szmuilowicz and Aleppo) | Define the problem (hypo, hyper or both) against TIR goals; locate it by time of day on the AGP; adjust therapy. Address hypoglycemia first. Make one therapeutic change per visit. | [S10] |
| PANTHER tool for Control-IQ | Big picture (patterns) then small picture (reasons) then plan (solutions). If TBR >4%, fix hypoglycemia patterns; if not, fix hyperglycemia patterns. | [S13] |
| Hammond AGP review | Data quality, then daily routine, then hypoglycemia patterns; if none, review overnight, morning meal, midday meal, evening meal in turn | [S12] |
| Walsh pattern management | Stop frequent lows first; fix bedtime highs before breakfast highs; address rebound highs after overtreated lows | [S26] |
| Mount Sinai pattern principles | Look for lows before highs; check overnight values to adjust basal before meal-related highs | [S28] |
| AID consensus (Phillip et al.) | Describe the system (CARES), assess glycemic data, optimize AID settings, guide behavior (bolus behavior, special modes, infusion set changes) | [S21] |

AGP reading rules:

- Hypoglycemia window: times when the 5th-10th percentile curve falls below 3.9 mmol/L [S10]. Hammond uses the 10th centile approaching or entering the hypoglycemic range [S12].
- Hyperglycemia window: times when the 75th percentile is above 10.0 mmol/L [S10].
- Wide spread below the median means raising insulin for a high median carries more hypoglycemia risk; little spread below the median means less risk [S12].
- Averaging many days can hide a pattern, so daily views matter alongside the AGP [S12].

Change size and pace in the sources:

- Small adjustments of about 10-20%, then reassess after a few days; adjust sooner if hypoglycemia rises markedly [S19].
- Confirm high-glucose trends for 2-3 days before adjusting; for lows, consider adjusting immediately [S27].

## 4. Control-IQ facts that change the analysis

### 4.1 What the algorithm does

Control-IQ predicts glucose 30 minutes ahead and adjusts insulin every 5 minutes [S16]. Thresholds by mode, from Tandem's mmol/L quick reference [S15]:

| Action (on predicted glucose) | Normal | Sleep Activity | Exercise Activity |
|---|---|---|---|
| Automatic correction bolus if above | 10.0 | none | 10.0 |
| Increase basal if above | 8.9 | 6.7 | 8.9 |
| Keep Personal Profile basal between | 6.25-8.9 | 6.25-6.7 | 7.8-8.9 |
| Decrease basal if below | 6.25 | 6.25 | 7.8 |
| Stop basal if below | 3.9 | 3.9 | 4.4 |

Automatic correction bolus: when glucose is predicted above 10.0 mmol/L, Control-IQ calculates a correction from the Personal Profile settings with a target of 6.1 mmol/L and delivers 60% of that amount [S15]. It occurs at most once per hour [S15] and not within 60 minutes of a bolus that was delivered or cancelled [S15] [S17]. No automatic correction boluses are delivered while Sleep Activity is on [S16]. Automatic corrections can still occur during Exercise Activity [S22].

Other behavior:

- Without CGM data for 20 minutes, the pump reverts to the programmed Personal Profile basal with no adjustment, and resumes automation when CGM data returns [S13]. "The system cannot adjust insulin dosing if the pump is not receiving CGM readings" [S15].
- To turn Control-IQ on, the user must enter weight and total daily insulin (TDI), have an active Personal Profile with carbs turned on, and have an active CGM session [S15]. Weight and TDI are used mainly to set maximum and minimum delivery constraints and should be updated at each visit [S13].
- Sleep Activity can run on two schedules or be started by hand [S16]. Exercise Activity on software 7.7 or later can be set for 30 minutes to 8 hours [S22].
- Control-IQ is indicated from age 6 and not for people needing less than 10 units a day or weighing less than 25 kg [S15].

### 4.2 What the user and clinician can change, and what is fixed

| Item | Status under Control-IQ | Source |
|---|---|---|
| Basal rates (timed segments) | Adjustable | [S13] [S14] |
| Correction factor (ISF) | Adjustable; affects user corrections, automatic corrections, and how freely basal is modulated | [S13] [S14] [S18] |
| Carb ratio | Adjustable | [S13] [S14] |
| Weight, TDI | Adjustable; set delivery constraints | [S13] [S15] |
| Sleep schedule, Exercise Activity | User controlled | [S16] |
| Correction target for automatic boluses | Fixed at 6.1 mmol/L | [S13] [S19] |
| Active insulin time | Fixed at 5 hours | [S13] [S19] |
| Treatment ranges in 4.1 | Fixed by mode | [S15] |

Not verified in this research: whether the Personal Profile target BG and max bolus fields influence any Control-IQ behavior, and whether a fixed cap on automatic correction bolus size exists. Tandem's user guide was not reachable, and no fetched source gave these. The dashboard should read and display these fields without attaching rules to them until checked against the current user guide.

### 4.3 Tandem's own tuning guidance

Tandem's "Easy to start, easy to adjust" sheet (MAT-0664) [S14]:

- Starting formulas: basal = 50% of pump TDI / 24 h; correction factor = 95 / pump TDI (mmol/L) or 1700 / pump TDI (mg/dL); carb ratio = 450 / pump TDI.
- Review targets: time in automation >90%; Sleep Activity 7 times a week; assess manual bolus versus AutoBolus.
- "When in doubt, prioritise Correction Factor to optimise both basal modulation and correction boluses."
- Stronger correction factor: <88 / pump TDI (mmol/L) or <1580 / pump TDI (mg/dL), described as maximizing TIR without significantly increasing TBR.
- Hypo- or hyperglycemia not related to bolusing: change basal rates.
- Not bolusing consistently: strengthen correction factor.
- Hypo- or hyperglycemia after bolusing: adjust correction factor and/or carb ratio.

Tandem's correction factor page adds: start new users at <=1700/TDI, prioritize early optimization on days 3-14, and consider an even stronger factor such as <1500/TDI for people who struggle with meal bolusing [S18].

Evidence behind this: Messer and Breton analyzed real-world Control-IQ settings standardized by TDI. The most aggressive correction factor quartile had median TIR 79.1% versus 65.0% for the least aggressive, and time <3.9 mmol/L changed by about 0.15 percentage points across correction factor quartiles [S19]. More aggressive basal and carb ratio settings also went with higher TIR and slightly more hypoglycemia; basal above about 55% of TDI may predict more hypoglycemia [S19]. User-initiated boluses per day were the strongest predictor of all outcomes [S19]. The analysis is retrospective and associative, children and adolescents were underrepresented, the authors say it should not be used as a formula, and the lead author is a Tandem employee [S19].

PANTHER ranks the most impactful settings as carb ratio first ("it is common to need stronger I:C Ratios with AID"), then correction factor, then basal rates [S13].

### 4.4 What Control-IQ data can and cannot show

Sourced points:

- Low glucose often follows a period when the system already reduced or stopped basal, so insulin on board before a low can be lower than the programmed basal suggests. PANTHER and the AID consensus both advise treating mild lows with less carbohydrate (5-10 g) for this reason [S13] [S21].
- A user bolus given while automation has raised delivery adds to that insulin. PANTHER links "low follows high" to bolus calculator overrides and stacking [S13].
- Messer et al. could not separate automatic correction boluses from user correction boluses in the reports they had [S20]. The dashboard should check whether its export flags automatic boluses before using any autobolus rule.
- Periods without CGM data run on programmed basal [S13], so glucose behavior in those periods reflects the Personal Profile, not the algorithm.
- Settings-outcome associations from real-world Control-IQ data are not causal [S19].

Derived (not stated by a source):

- The classic basal test (drift >1.7 mmol/L over 8 hours of sleep with no food or bolus, section 5.2) assumes fixed basal delivery. Under Control-IQ a flat overnight trace can result from the algorithm raising or cutting basal. The dashboard should therefore compare delivered basal with programmed basal for the same hours, and only apply the drift rule to periods where automation was off.
- A time-of-day cluster of automatic correction boluses, or delivered basal consistently above programmed basal at the same hours, is a signal that the programmed basal or correction factor for that period may be weaker than the system needs. No fetched source states this rule. The closest sourced statements are Tandem's "hyperglycemia not related to bolusing: change basal rates" and its advice that the correction factor drives both basal modulation and AutoBolus [S14] [S18].

## 5. Rule catalogue

Each rule lists: signal, threshold, minimum evidence, the setting or behavior it points at, and the source. "Window" means the 90-day dataset split into 14-day periods unless stated. Rules in 5.1 gate the rest.

### 5.1 Data quality gates

R-DQ-1 Sensor coverage
- Signal: percent of expected CGM readings present per 14-day window.
- Threshold: <70% means the window is not sufficient for metrics [S1]; <75% is a major flag in Gehrmann [S9]; PANTHER aims for CGM inactive <10% [S13].
- Minimum evidence: one 14-day window.
- Points at: sensor wear, adhesion, pump-CGM connection. PANTHER lists site rotation, adhesives, and wearing pump and sensor on the same side [S13].
- Action: suppress settings rules for windows below 70%.

R-DQ-2 Time in automation
- Signal: percent of time Control-IQ was active.
- Threshold: <90% [S13] [S14].
- Minimum evidence: one 14-day window.
- Points at: reasons automation was off. Each 1% of automation use was associated with 0.18 percentage points more TIR in youth [S20].

R-DQ-3 Sleep Activity use
- Signal: average hours per day in Sleep Activity and nights per week with it on.
- Threshold: average <6 h/day [S13]; fewer than 7 nights a week [S14].
- Minimum evidence: 14 days.
- Points at: sleep schedule setup. Clinicians have seen users schedule it for one night a week by mistake [S20].

R-DQ-4 Possible infusion set failure
- Signal: sustained high glucose not explained by a missed bolus.
- Threshold: >16.7 mmol/L for 2 hours or more [S13].
- Minimum evidence: one episode is enough to flag for the family; PANTHER pairs it with a ketone check and set change [S13].
- Points at: infusion set, not settings. Derived: exclude these episodes from settings rules.

R-DQ-5 Sensor artifacts
- Signal: suspected compression lows, early sensor failure, or interference.
- Threshold: none given. DATAA lists lag, early sensor failure, compression lows, dehydration and medication interference (vitamin C, acetaminophen, high-dose salicylic acid) as causes of false readings [S11].
- Derived: flag sharp overnight drops with fast recovery and no carb entry as possible compression lows and exclude them from hypoglycemia pattern counts only after a family review.

### 5.2 Global outcome flags

| ID | Signal | Threshold | Source |
|---|---|---|---|
| R-G-1 | TBR <3.9 mmol/L | >4%; switches review to hypoglycemia-first mode | [S1] [S2] [S13] |
| R-G-2 | TBR <3.0 mmol/L | >1% | [S1] [S2] |
| R-G-3 | TIR 3.9-10.0 | <70%; <50% is a major flag | [S1] [S2] [S9] |
| R-G-4 | TIR change | drop of >10 between consecutive 14-day windows | [S9] |
| R-G-5 | TAR >10.0 / >13.9 | >25% / >5% | [S1] [S2] |
| R-G-6 | CV | >36% | [S1] |
| R-G-7 | TITR 3.9-7.8 | <50% | [S2] [S7] |
| R-G-8 | GRI | trend only; higher is worse | [S5] |
| R-G-9 | GMI | compare with lab HbA1c; target <=6.5% with AID | [S2] [S6] |

### 5.3 Hypoglycemia rules (evaluate first)

R-H-1 Hypoglycemia time window
- Signal: AGP 5th or 10th percentile below 3.9 mmol/L in a time-of-day bin.
- Threshold: percentile below 3.9 [S10] [S12].
- Minimum evidence: sources do not give a count. Mount Sinai calls it a pattern when the same response appears in 2 of 3 similar situations [S28]. Derived: require the window on the 14-day AGP plus at least 3 separate days with a 15-minute event (section 2.4) in that window.
- Points at: classify by timing using R-H-2 to R-H-6, as PANTHER does [S13].

R-H-2 Overnight or fasting lows
- Signal: events between sleep start and wake that are not within 3 hours of a bolus.
- Threshold: event rule in section 2.4.
- Minimum evidence: as R-H-1. For lows, sources favor acting without waiting for 2-3 days of confirmation [S27].
- Points at: programmed basal. PANTHER: reduce basal rates 10-20% in the 1-2 hours before the hypoglycemia [S13]. Walsh instead looks at basal and bolus in the 5-8 hours before a time-of-day low [S26]; the two sources differ on the lookback.
- Control-IQ note: check whether the algorithm had already decreased or stopped basal before the low (section 4.4).

R-H-3 Post-meal lows
- Signal: low 1-3 hours after a meal bolus [S13].
- Threshold: event rule in section 2.4; or a 2-hour post-meal rise <1.7 mmol/L over pre-meal, which the Omnipod order form reads as a carb ratio that gives too much insulin [S27].
- Minimum evidence: as R-H-1, counted per meal slot (breakfast, lunch, dinner).
- Points at: carb counting accuracy, bolus timing and meal composition first, then a weaker carb ratio. PANTHER gives 10-20% as its example (1:10 g to 1:12 g) [S13].

R-H-4 Lows after corrections
- Signal: low 2-3 hours after a correction bolus with no carbs in between.
- Threshold: event rule in section 2.4.
- Minimum evidence: as R-H-1.
- Points at: correction factor too strong. PANTHER: weaken by 10-20%, which also changes automatic corrections [S13]. Walsh lists lows after corrections under a correction factor that is too low, short DIA, or "rage boluses" [S26].

R-H-5 Low follows high
- Signal: a manual bolus larger than the calculator recommendation, or a manual correction while automation was increasing delivery, followed by a low.
- Threshold: no number in the source.
- Minimum evidence: Derived: 3 occurrences in the window.
- Points at: behavior, not settings. PANTHER: follow the bolus calculator, which already accounts for insulin on board from automation [S13].

R-H-6 Exercise-related lows
- Signal: lows during activity or up to 24 hours after it.
- Threshold: event rule in section 2.4. ISPAD 2022 states that hypoglycemia risk rises during, shortly after, and up to 24 hours after exercise [S33].
- Minimum evidence: needs activity data (Exercise Activity events, a sports calendar, or family tags). Derived: 2 or more episodes linked to the same activity.
- Points at: use of Exercise Activity 1-2 hours before exercise [S13] [S22]; meal bolus reduction of 25-33% for meals within 2 hours before activity [S22]. These are clinic decisions.

R-H-7 Frequent lows at varied times
- Signal: lows at many different times, not tied to exercise.
- Threshold: readings <3.3 mmol/L (60 mg/dL) 4 or more times a week [S26].
- Minimum evidence: 2 consecutive weeks (derived).
- Points at: total insulin too high overall [S26]. Under Control-IQ, also review the weight and TDI entered on the pump [S13].

### 5.4 Hyperglycemia rules

R-Y-1 Hyperglycemia time window
- Signal: AGP 75th percentile above 10.0 mmol/L in a time-of-day bin [S10].
- Minimum evidence: Derived: 14-day AGP plus at least 3 days with the median above 10.0 mmol/L in the same bin.
- Points at: classify by timing using R-Y-2 to R-Y-7.

R-Y-2 Overnight or fasting highs
- Signal: high glucose during sleep or at wake.
- Threshold: AGP rule above. Classic basal rule: a rise of more than 1.7 mmol/L over 8 hours of sleep or any 5 fasting hours awake means basal needs review [S24].
- Minimum evidence: highs should be confirmed over 2-3 days [S27].
- Points at: first, Sleep Schedule on every night; then basal rates 10-20% higher in the 1-2 hours before the rise [S13]. Walsh lists pre-breakfast highs as caused by bedtime highs, night basal too low or high-fat dinner, dawn phenomenon, or overtreated night lows [S26].
- Control-IQ note: apply the drift rule only to periods with automation off (section 4.4, derived).

R-Y-3 Post-meal highs
- Signal: glucose rise from the pre-meal value to 2 hours after the meal, for meals with a carb entry and bolus.
- Threshold: rise >3.3 mmol/L (60 mg/dL). The AID consensus uses <3.3 mmol/L as the post-meal goal [S21]; the Omnipod form reads >3.3 mmol/L as a carb ratio giving too little insulin [S27]. Walsh's carb factor test expects glucose back within 1.1 mmol/L of the start at 5 hours and a peak below 8.9 mmol/L [S25].
- Measurement window: 1 hour before to 4 hours after the meal start [S21].
- Minimum evidence: 2-3 days of confirmation for highs [S27]; Derived: at least 3 qualifying meals in the same meal slot.
- Points at: check for missed or late bolus first [S13]; then carb counting and timing; then a stronger carb ratio. PANTHER example: 10-20% (1:10 g to 1:8 g) [S13]. The AID consensus notes that some systems benefit from a carb ratio 10-20% more aggressive [S21].

R-Y-4 Highs after corrections
- Signal: glucose still high 1-3 hours after a correction bolus [S13].
- Minimum evidence: Derived: 3 corrections in the window.
- Points at: stronger correction factor. PANTHER example: 50 mg/dL per unit to 40 [S13]. This also strengthens automatic corrections.

R-Y-5 High follows low (rebound)
- Signal: glucose >8.3 mmol/L (150 mg/dL) within 1-2 hours after a low [S26].
- Minimum evidence: Derived: 3 episodes.
- Points at: treating lows with 5-10 g carbohydrate and waiting 15 minutes [S13]. Not a settings change.

R-Y-6 Hyperglycemia not related to bolusing
- Signal: highs in periods with no user bolus in the prior 4 hours (derived window).
- Points at: basal rates [S14].

R-Y-7 Correction factor relative to TDI
- Signal: current correction factor x pump TDI.
- Threshold: Tandem calls <88 (mmol/L units) or <1580 (mg/dL units) a stronger setting associated with higher TIR without more TBR, and suggests starting at <=95 or <=1700 [S14] [S18].
- Minimum evidence: TDI averaged over 14 days.
- Points at: a question for the clinic about correction factor strength. Company-sourced and associative [S19].

### 5.5 Insulin balance rules

R-B-1 Meal bolus share
- Signal: food boluses as a share of total daily insulin.
- Threshold: <50% prompts PANTHER to assess missed meal boluses or weak carb ratios [S13]. Walsh gives carb boluses as usually 36-45% of TDD and suggests a stronger carb ratio when below about 40-45% with frequent highs [S26]. The two sources use different cutoffs.
- Minimum evidence: 14 days.

R-B-2 Basal share
- Signal: basal (programmed and delivered, separately) as a share of TDI.
- Threshold: guideline reference about 50% [S14] [S19]; above about 55% may predict more hypoglycemia under Control-IQ [S19]; Walsh gives 45-60% for adolescents and adults [S26].
- Minimum evidence: 14 days.

R-B-3 Correction share
- Signal: correction insulin (user plus automatic) as a share of TDD.
- Threshold: Walsh keeps corrections below 10% of TDD [S26].
- Control-IQ note: automatic corrections are part of normal operation, and people who bolus less get more of their insulin this way [S19]. Derived: show this share as a trend, not a pass or fail.

R-B-4 Meal bolus count
- Signal: food boluses per day, counting only boluses with carbs entered and not automatic corrections [S13].
- Threshold: no fixed number. In youth on Control-IQ, meal boluses fell from 4.4 to 4.0 per day over 6 months, and more meal boluses went with higher TIR [S20].
- Minimum evidence: 14 days; compare with the family's usual number of meals and snacks.

## 6. Teen-specific factors

R-T-1 Dawn phenomenon
- Background: in a pump study, 15-21-year-olds had higher basal rates from 03:00 to 07:00, while 3-9-year-olds had higher rates in the late evening [S29]. Walsh writes that many teens and adults need a higher predawn basal, starting around 03:00 [S24].
- Signal: median glucose rising between 03:00 and 07:00 on most nights, or delivered basal under Control-IQ consistently above programmed basal in that period (derived).
- Threshold: rise >1.7 mmol/L over the night with automation off [S24]; with automation on, derived comparison of delivered versus programmed basal.
- Minimum evidence: 2-3 days to confirm highs [S27]; Derived: present in at least half of nights in a 14-day window.
- Points at: early morning basal segments and Sleep Schedule timing [S13].

R-T-2 Missed or late meal boluses
- Background: missed meal boluses were described as the major cause of suboptimal control in youth on pumps [S30]. In 90 adolescents on pumps, 38% missed more than 15% of boluses on the study day, and bolus frequency correlated with control [S31]. About 10% of Control-IQ users had 7 or more consecutive days with no user-initiated bolus [S23].
- Signal: a meal-like CGM rise with no carb bolus. One published definition is a rate of change of 2 mg/dL/min (about 0.11 mmol/L/min) sustained for 20 minutes, with a bolus counted as missed if none came within 2 hours [S32]. This comes from a 2020 conference abstract.
- Slope rules miss slow rises, so not every meal is detected [S32]. Derived: show detections to the family for confirmation before counting them.
- Minimum evidence: Derived: rate per week over 14 days.
- Points at: behavior and reminders. Tandem's guidance for people not bolusing consistently is a stronger correction factor [S14] [S18]; PANTHER advises entering fewer carbs when bolusing after a meal because the system has already increased insulin [S13].

R-T-3 Late-night snacks
- Background: evidence in adolescents is thin. A crossover trial in 5-8-year-olds on injections found a 10 g bedtime snack lowered overnight TIR without reducing hypoglycemia [S36]. That paper cites work showing AID systems in older children can handle unannounced snacks up to 20 g, with higher spikes than announced meals [S36].
- Signal: Derived: R-T-2 detections between the evening meal and sleep start.
- Points at: bolusing for snacks; not a settings change.

R-T-4 Exercise and sport
- Background: risk of hypoglycemia during, shortly after, and up to 24 hours after exercise [S33]. Youth are encouraged to get 60 minutes of moderate to vigorous activity daily [S33].
- Signal: lows on sport days versus other days, including the following night. Needs a sport calendar or Exercise Activity events.
- Points at: Exercise Activity started 1-2 hours before and kept on until the end [S22]; a small manual bolus near exercise start blocks automatic corrections for 60 minutes [S22]; Sleep Activity can be used during activity when glucose tends to rise [S22]. These are clinic decisions.

R-T-5 Menstrual cycle
- Background: in 77 adults on AID tracking their cycles, TIR fell by 2.8 percentage points and TITR by 7.1 points from early follicular to early luteal phase, insulin needs peaked in the luteal phase, and 60% of participants showed the TIR decline [S34]. A smaller study of 16 women on Control-IQ found stable insulin delivery and glucose across phases [S35]. No published adolescent results were found; an adolescent study (MENSES) was still recruiting.
- Signal: Derived: if the family logs cycle start dates, compare TIR, mean glucose and total insulin by phase.
- Minimum evidence: Derived: at least 3 logged cycles (the 90-day dataset holds about 3).
- Points at: a question for the clinic. The data come from adults and the findings conflict.

## 7. Minimum evidence summary

| Question | What sources say | Source |
|---|---|---|
| Data needed for metrics | 14 days, at least 70% of readings | [S1] |
| What counts as a pattern | Same response in 2 of 3 similar situations | [S28] |
| Highs before acting | Confirm over 2-3 days | [S27] |
| Lows before acting | Consider acting immediately | [S27] |
| Change size | About 10-20%, reassess after a few days | [S13] [S19] [S27] |
| Changes per review | One therapeutic change per visit | [S10] |
| Review interval | Every 14 days in a pediatric remote review trial | [S9] |

Derived defaults used above where sources are silent: 3 qualifying days or events per pattern within a 14-day window, and suppression of settings rules in windows below 70% sensor coverage or 90% automation.

## 8. Gaps and unverified items

- ADA Standards of Care 2026 Section 6 and Section 14 primary pages returned HTTP 403; adult recommendations 6.3b and 6.3c were taken from a guideline summary [S3]. Pediatric 2026 wording was not checked.
- ISPAD 2024 gives TITR as 3.9-8 mmol/L (70-144 mg/dL) [S2]; other sources use 3.9-7.8 mmol/L [S7] [S9] [S34].
- GRI zone numeric cutoffs were not found in the text of the GRI paper [S5].
- No source fetched here confirms a fixed maximum size for a Control-IQ automatic correction bolus, or the role of Personal Profile target BG and max bolus under Control-IQ.
- No source fetched here states the rule "many automatic corrections at a time of day means basal or correction factor too weak". Section 4.4 marks it as derived.
- The Shah, Messer et al. 2026 review "Rethinking Control-IQ+ technology" (Diabetes Obes Metab 28(5):3502-3514) was found only as an abstract and was not used for rules.
- Burdick 2004 [S30] and Olinder 2009 [S31] were seen only at abstract level.
- Control-IQ+ (the newer software) was not separately researched; the thresholds above come from Control-IQ documents.

## Sources

- [S1] Battelino T, et al. Clinical targets for CGM data interpretation: recommendations from the International Consensus on Time in Range. Diabetes Care 2019;42(8):1593-1603. https://pmc.ncbi.nlm.nih.gov/articles/PMC6973648/
- [S2] de Bock M, et al. ISPAD Clinical Practice Consensus Guidelines 2024: Glycemic Targets. Horm Res Paediatr 2024;97(6):546-554. doi:10.1159/000543266. https://karger.com/hrp/article/97/6/546/918393
- [S3] American Diabetes Association. Standards of Care in Diabetes 2026, Section 6, as summarized by Guideline Central. https://www.guidelinecentral.com/guideline/14119/ (primary: https://diabetesjournals.org/care/article/49/Supplement_1/S132/163927, not reachable)
- [S4] ADA. 6. Glycemic Goals and Hypoglycemia: Standards of Care in Diabetes 2025. Diabetes Care 2025;48(Suppl 1):S128-S145. https://pubmed.ncbi.nlm.nih.gov/39651981/
- [S5] Klonoff DC, et al. A Glycemia Risk Index (GRI) of Hypoglycemia and Hyperglycemia for Continuous Glucose Monitoring Validated by Clinician Ratings. J Diabetes Sci Technol 2023;17(5):1226-1242. https://pmc.ncbi.nlm.nih.gov/articles/PMC10563532/
- [S6] Bergenstal RM, et al. Glucose Management Indicator (GMI): A New Term for Estimating A1C From Continuous Glucose Monitoring. Diabetes Care 2018;41:2275-2280. https://pmc.ncbi.nlm.nih.gov/articles/6196826 ; mmol/L forms and Dexcom-derivation caveat from https://www.healthcarelink.com.au/article/what-is-the-glucose-management-indicator-gmi/1688
- [S7] Sundberg F, et al. Using Time in Tight Glucose Range as a Health-Promoting Strategy in Preschoolers With Type 1 Diabetes. Diabetes Care, doi:10.2337/dci24-0058. https://diabetesjournals.org/care/article/doi/10.2337/dci24-0058/157464/ (read via https://dagensdiabetes.se/using-time-in-tight-glucose-range-diab-care-frida-sundberg-et-al/)
- [S8] Battelino T, et al. CGM and metrics for clinical trials: an international consensus statement. Lancet Diabetes Endocrinol 2023;11:42-57. https://doi.org/10.1016/S2213-8587(22)00319-9 ; event definitions as quoted in https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12673437/
- [S9] Gehrmann FE, et al. Scheduled Remote Review of CGM Data with Targeted Intervention versus Standard Care in Children with Type 1 Diabetes. Horm Res Paediatr 2026. https://karger.com/article/doi/10.1159/hrp/adaag028
- [S10] Szmuilowicz E, Aleppo G. A simple 3-step approach to CGM data interpretation. https://ca.provider.dexcom.com/articles/simple-3-step-approach-cgm-data-interpretation
- [S11] Isaacs D, DATAA model, in: Utilizing CGM Data for Diabetes Management. US Pharmacist, 5 April 2024. https://www.uspharmacist.com/article/utilizing-cgm-data-for-diabetes-management
- [S12] Hammond P. Interpreting the ambulatory glucose profile. Br J Diabetes 2016;16(Suppl 1):S10-S15. https://www.bjd-abcd.com/index.php/bjd/article/download/131/273?inline=1
- [S13] PANTHER Tool for Control-IQ, v.06.2023. https://cdn.baptistjax.com/image/upload/v1711641989/WolfsonChildrens/Services/Endo/PANTHER_Control-IQ_0623.pdf
- [S14] Tandem Diabetes Care. Tandem AID systems: Easy to start, easy to adjust (MAT-0664), hosted by NHS Forth Valley. https://nhsforthvalley.com/wp-content/uploads/2026/04/How-to-Make-Control-IQ-Adjustments.pdf
- [S15] Tandem Diabetes Care. t:slim X2 Control-IQ technology quick reference, mmol/L (Canada, ML-1007822). https://www.tandemdiabetes.com/docs/default-source/general-guides/ml-1007822_c-quick-reference-control-iq-mmoll-canada.pdf
- [S16] Tandem Diabetes Care. Sleep and Exercise Activity quick reference, Control-IQ. https://www.tandemdiabetes.com/docs/default-source/quick-reference/quick-reference-sleep-and-exercise-control-iq.pdf
- [S17] Tandem Diabetes Care. Introducing Control-IQ Technology (ML-1005029). https://tcoyd.org/wp-content/uploads/2021/03/Control-IQ-Trifold.pdf
- [S18] Tandem Diabetes Care. Correction Factor: One Simple Setting Adjustment for Better Glucose Control. https://www.tandemdiabetes.com/healthcare-professionals/learning-center/correction-factor-one-simple-setting-adjustment-for-better-glucose-control
- [S19] Messer LH, Breton MD. Therapy Settings Associated with Optimal Outcomes for t:slim X2 with Control-IQ Technology in Real-World Clinical Care. Diabetes Technol Ther 2023;25(12):877-882. https://pmc.ncbi.nlm.nih.gov/articles/PMC10698772/
- [S20] Messer LH, et al. Real-World Use of a New Hybrid Closed Loop Improves Glycemic Control in Youth with Type 1 Diabetes. Diabetes Technol Ther 2021;23(12):837-843. https://pmc.ncbi.nlm.nih.gov/articles/PMC8819505/
- [S21] Phillip M, et al. Consensus Recommendations for the Use of Automated Insulin Delivery Technologies in Clinical Practice. Endocr Rev 2023;44(2):254-280. https://pmc.ncbi.nlm.nih.gov/articles/PMC9985411/
- [S22] Moser O, Zaharieva DP, et al. The use of automated insulin delivery around physical activity and exercise in type 1 diabetes: a position statement of the EASD and ISPAD. Diabetologia 2025;68(2):255-280. https://pmc.ncbi.nlm.nih.gov/articles/PMC11732933/
- [S23] Polin MR, et al. What happens when people don't bolus for extended periods of time while using Control-IQ technology. EMJ 2024;9(3):24-28. https://www.emjreviews.com/flagship-journal/symposium/what-happens-when-people-dont-bolus-for-extended-periods-of-time-while-using-control-iq-technology/
- [S24] Walsh J. Basal Insulin and Basal Rates. DiabetesNet. https://www.diabetesnet.com/diabetes-technology/insulin-pumps/pump-features/basal-insulin-and-basal-rates/
- [S25] Walsh J. Check Carb Factor or ICR. DiabetesNet. https://www.diabetesnet.com/diabetes-tools/insulin-dose-guide/check-carb-factor-or-icr/
- [S26] Walsh J. Use Pattern Management. DiabetesNet. https://www.diabetesnet.com/diabetes-tools/insulin-dose-guide/use-pattern-management/
- [S27] Insulet. Omnipod DASH Pump Therapy Order Form, patient instructions for insulin adjustments. https://www.omnipod.com/sites/default/files/2021-04/Omnipod-DASH_PumpTherapyOrderForm_FREEDOM.pdf
- [S28] Mount Sinai Hospital (Toronto), Leadership Sinai Centre for Diabetes. What are Pattern Management Principles, Part 1. https://mountsinai.on.ca/care/lscd/sweet-talk-1/what-are-pattern-management-principles-part-1 (the page now redirects; content was read from the search index)
- [S29] Nicolajsen T, Samuelsson A, Hanas R. Insulin Doses before and One Year after Pump Start: Children Have a Reversed Dawn Phenomenon. J Diabetes Sci Technol 2012;6(3):589-594. https://pmc.ncbi.nlm.nih.gov/articles/PMC3440064/
- [S30] Burdick J, et al. Cross-sectional study of causes of suboptimal control in 48 youths on pump therapy. Pediatrics 2004;113(3):e221. https://doi.org/10.1542/peds.113.3.e221
- [S31] Olinder AL, Kernell A, Smide B. Missed bolus doses: devastating for metabolic control in CSII-treated adolescents with type 1 diabetes. Pediatr Diabetes 2009;10(2):142-148. https://doi.org/10.1111/j.1399-5448.2008.00462.x
- [S32] Klue meal-detection reminder study, ATTD 2020 e-poster 551. https://cslide.ctimeetingtech.com/attd2020/attendee/eposter/poster/551
- [S33] ISPAD Clinical Practice Consensus Guidelines 2022: Exercise in children and adolescents with diabetes. Pediatr Diabetes 2022;23(8):1341-1372. https://doi.org/10.1111/pedi.13452
- [S34] Hossmann S, et al. Observational study of menstrual cycle phases in adults using AID. Diabetes Care 2026, doi:10.2337/dc26-0692, as reported by Healio. https://www.healio.com/news/endocrinology/20260901/glucose-insulin-sensitivity-fluctuate-during-menstrual-cycle-in-type-1-diabetes
- [S35] Levy CJ, et al. Insulin Delivery and Glucose Variability Throughout the Menstrual Cycle on Closed Loop Control for Women with Type 1 Diabetes. Diabetes Technol Ther 2022;24(5):357-361. https://pmc.ncbi.nlm.nih.gov/articles/PMC9127830/
- [S36] Gökçe T, et al. Bedtime snacking and glycemic deterioration in young children with Type 1 diabetes on multiple daily injections. Nutr Diabetes 2025;15:49. https://pmc.ncbi.nlm.nih.gov/articles/PMC12639072/
