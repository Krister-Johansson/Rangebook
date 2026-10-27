# Algorithms for trend finding and pump-settings review

Research date: 2026-10-27. Scope: a browser dashboard for one teenager on a Tandem t:slim X2 with Control-IQ, fed by a Glooko-style export (5-minute CGM in mmol/L, bolus records with carbs and insulin, basal records, alarms, 90 days). The goal is to find patterns and to list settings (basal by time block, carb ratio, correction factor) worth discussing with the care team. Nothing here is meant to change doses automatically.

Repository metadata (license, language, last push, archived flag) comes from the GitHub API on the research date unless another source is named. "Last push" is the date of the most recent push to any branch.

## 1. Settings-estimation algorithms

### 1.1 OpenAPS Autotune (oref0)

Sources: docs at https://openaps.readthedocs.io/en/latest/docs/Customize-Iterate/autotune.html, code at https://github.com/openaps/oref0 (`lib/autotune-prep/categorize.js`, `lib/autotune/index.js`).

- License: MIT. Language: JavaScript (Node). Last push 2026-10-17, not archived. The docs still call Autotune a work in progress.
- Pipeline: `oref0-autotune-prep` computes, for every glucose point, the expected glucose impact of insulin (BGI) and the deviation between observed and expected change. `oref0-autotune-core` then turns the bucketed deviations into new settings.

How it computes deviations (from `categorize.js`):

- `BGI = -iob.activity * sens * 5`, where insulin activity comes from oref0's IOB module run over the previous 6 hours of pump history, and `sens` is the scheduled ISF at that time.
- `avgDelta` is the average change over the last four 5-minute readings. `deviation = avgDelta - BGI`. Positive deviations below 80 mg/dL are set to 0.
- The basal used for IOB is the average of the scheduled basal at the current hour and 1, 2 and 3 hours earlier.

How it attributes each point (in order):

- CSF (carbs): while carbs on board (COB) are positive or absorption is ongoing. COB decays by `max(deviation, min_5m_carbimpact) * carb_ratio / sens` per step. Absorption ends when IOB falls below half the current hourly basal or the deviation is no longer positive.
- UAM (unannounced meal): if IOB is more than twice the hourly basal, the deviation exceeds 6 mg/dL per 5 minutes, or a UAM period is ongoing.
- Basal: if `basalBGI > -4 * BGI` (insulin activity is small relative to basal), or if glucose is rising faster than insulin can explain (`avgDelta > 0 && avgDelta > -2*BGI`).
- ISF: everything else.
- Rebalancing: UAM data is folded into basal when there are many meal points or `--categorize-uam-as-basal` is set; other rules move data between buckets when one bucket is too small. Carb-ratio periods shorter than 60 minutes are discarded.

How it tunes (from `lib/autotune/index.js`):

- Basal: deviations are summed per clock hour. `basalNeeded = 0.2 * deviations / ISF`. Increases are spread equally over the three preceding hours; decreases scale those three hours proportionally. Results are capped at `autosens_max` and `autosens_min` times the pump basal (defaults 1.2 and 0.7). Hours without data are smoothed toward neighbours.
- ISF: for each ISF point, `ratio = 1 + deviation / BGI`; the median ratio gives a full new ISF. Fewer than 10 ISF points leaves ISF unchanged. The result is blended `0.8 * old + 0.2 * new` and capped against the pump value.
- Carb ratio: per meal period, total insulin is initial IOB plus insulin dosed plus the insulin still "required" by remaining deviations. `fullNewCR = total carbs / total insulin`, blended `0.8 * old + 0.2 * new`, capped against the pump value and to the range 3 to 150.
- Optional DIA and peak-time tuning, described in the docs as experimental.

Input requirements: a `profile.json` with DIA, basal schedule, a single ISF and single carb ratio (ISF in mg/dL/U), autosens limits; glucose entries and treatments, normally pulled from Nightscout with `--ns-host`. The docs warn that missing carb entries push Autotune to raise basals. The docs state that tuning is "based on *one* ISF and carb ratio throughout the day". The AndroidAPS port says the same: it tunes a single IC, a single ISF and an hourly basal (https://androidaps.readthedocs.io/en/3.1/Usage/autotune.html).

Non-OpenAPS data: the docs describe running `oref0-autotune` on a Mac, Linux or WSL machine against any Nightscout site, including for people not using OpenAPS. An OpenAPS guide notes that temp basals must be uploaded as absolute rates for correct results (https://draft-openaps-reorg.readthedocs.io/en/reapply-cleanup/docs/Usage%20and%20maintenance/running-autotune.html).

Web front ends:

- AutotuneWeb (https://github.com/MarkMpn/AutotuneWeb): C#, no license file, archived 2026-06-12; the README says it is discontinued.
- Nighttune (https://github.com/houthacker/nighttune): TypeScript front end with a separate backend, GPL-3.0, last push 2026-08-31. It describes itself as a successor to AutotuneWeb, adds Savitzky-Golay basal smoothing and an hourly-basal option.

Would it work on a Control-IQ export? Not directly. Tandem data can reach Nightscout through tconnectsync (section 4), but I found no source that documents Autotune results on Tandem or Control-IQ data. The obstacles are structural:

- oref0 computes insulin activity from scheduled basal plus temp basals. Control-IQ changes basal delivery every few minutes and gives automatic correction boluses (section 1.5). Unless every change is represented as an absolute-rate temp basal and every automatic bolus is present, BGI is wrong and the deviations are wrong.
- Autotune assumes the scheduled basal is what was delivered when nothing else happened. Under Control-IQ the "fasting" periods are the periods where the loop is most active, so the basal bucket mostly measures how much the loop compensated, not what the schedule should be.
- One ISF and one carb ratio for the whole day does not match a Tandem profile with time-segmented carb ratios and correction factors.
- The 20 percent blending and the 1.2/0.7 caps were designed for nightly iterative runs inside OpenAPS, not a one-shot 90-day report.

What is reusable: the deviation formula, the bucket logic, and the per-meal "total insulin versus carbs" calculation. These are MIT-licensed and small enough to port to TypeScript with a license notice.

### 1.2 Autosens (oref0 and AndroidAPS)

Sources: `lib/determine-basal/autosens.js` in https://github.com/openaps/oref0; AndroidAPS docs at https://androidaps.readthedocs.io/en/latest/DailyLifeWithAaps/SensitivityDetectionAndCob.html; OpenAPS determine-basal docs at https://openaps.readthedocs.io/en/latest/docs/While%20You%20Wait%20For%20Gear/Understand-determine-basal.html.

- oref0 autosens uses the same deviation calculation over the last 24 hours (or since the last site change), excludes meal absorption and UAM periods, and keeps the last 96 non-excluded points (about 8 hours). It takes the median deviation, converts it to an hourly insulin offset (`basalOff = median * 12 / ISF`), and forms `ratio = 1 + basalOff / max_daily_basal`, capped by `autosens_min` and `autosens_max`. The new ISF is `ISF / ratio`.
- The OpenAPS docs say the ratio "is applied to both basal and ISF".
- AndroidAPS (Kotlin, AGPL-3.0, https://github.com/nightscout/AndroidAPS, last push 2026-10-27) offers three sensitivity plugins. Oref1 looks back 8 hours or to the last site change and excludes UAM periods; WeightedAverage weights recent deviations more.

Fit for us: autosens answers "is today more or less sensitive than the profile", not "which setting is wrong". A daily autosens-style ratio is still a useful trend line on a dashboard (for example around illness, sport or puberty growth phases), with the same Control-IQ caveat as Autotune.

### 1.3 Loop and related parameter estimation

- Loop (https://github.com/LoopKit/Loop, Swift, license reported as NOASSERTION by GitHub, last push 2026-10-27) uses settings entered by the user. The LoopKit README states that the library "does not make treatment decisions" (https://github.com/LoopKit/LoopKit). I found no settings estimator inside LoopKit.
- Tune by Marius Eriksen (https://github.com/mariusae/tune): Python, no license file, last push 2023-07-06, 9 stars. It fits time-of-day schedules of basal, carb ratio and ISF to a "basal and bolus" model. From `model.py`: data is resampled to 5 minutes, a 6-hour window of past insulin and carbs predicts glucose change, the insulin curve is the exponential model credited to Dragan Maksimovic, and parameters are found with `scipy.optimize` using `autograd`. It accepts current settings and a `tuning_limit` around them. The README notes the example data comes from one user. No license means we cannot reuse the code, but the approach (fit per-block parameters by minimising prediction error) is a documented alternative to Autotune's bucket heuristics.
- Lum et al. 2021, the real-world Loop observational study (Diabetes Technol Ther 23(5):367 to 375, https://doi.org/10.1089/dia.2020.0535), reports safety and outcomes, not a settings algorithm.

### 1.4 Clinical and academic settings-optimization work

- DreaMed Advisor Pro (commercial, closed source). Nimri et al. 2020, J Diabetes Sci Technol (https://pmc.ncbi.nlm.nih.gov/articles/PMC8861776): the system finds glucose patterns and dosing events, then proposes basal, carb ratio and correction factor changes, capped at plus or minus 20 percent for basal and 30 percent for CR and CF. Physicians agreed with each other on the direction of change only about half the time (51.8 percent basal, 54.2 percent CR, 49.8 percent CF), and the device agreed with physicians at similar rates. The ADVICE4U randomized trial in 108 youths aged 10 to 21 found the AI adjustments non-inferior to physician titration (Nimri et al., Nature Medicine 2020, https://doi.org/10.1038/s41591-020-1045-7; NCT03003806). That trial used pumps, not a hybrid closed loop.
- Run-to-run (R2R) adaptation from Padova, Pavia and Girona groups: Toffanin and colleagues adapt overnight basal and daytime carb ratio from CGM-derived indices; Herrero, Bondia, Gimenez, Oliver and Georgiou 2018, "Automatic Adaptation of Basal Insulin Using Sensor-Augmented Pump Therapy" (J Diabetes Sci Technol), adapt basal profiles with a run-to-run law. Example sources: https://iris.unipv.it/handle/11571/1178646 and https://pmc.ncbi.nlm.nih.gov/articles/PMC5851242. Most results are in silico (UVA/Padova simulator).
- Adaptive settings for Control-IQ: NCT05204134, "Adaptation of Insulin Delivery Settings to Improve Clinical Outcomes With AID Use", describes a server-based system that initializes and adapts Control-IQ settings (protocol at https://cdn.clinicaltrials.gov/large-docs/34/NCT05204134/Prot_SAP_000.pdf). I did not find published results or code.
- Tidepool: its basal-optimization material is a clinician blog post about reviewing actual basal delivery over several days (https://tidepool.org/blog/optimizing-basal-rates-with-dr-saleh-adi). I found no Tidepool open-source settings estimator. The Tidepool data-science repos found are API bindings and a handbook (https://github.com/tidepool-org/data-science-tidepool-api-python, BSD-2-Clause, last push 2023-07-06).

### 1.5 Control-IQ facts that shape any algorithm

Sources: PANTHER Control-IQ clinician worksheet v.06.2023 from pantherprogram.org (https://cdn.baptistjax.com/image/upload/v1711641989/WolfsonChildrens/Services/Endo/PANTHER_Control-IQ_0623.pdf), German Diabetes Society AGDT fact sheet, January 2022 (https://www.diabetesnet.com/pdfs/Tandem-t-slimX2-with-Control-IQ.pdf), Tandem support (https://www.tandemdiabetes.com/support-center/pumps-and-supplies/automated-insulin-delivery/article/using-personal-profiles-with-control-iq).

- Decisions use glucose predicted 30 minutes ahead. In normal mode: above 180 mg/dL (10.0 mmol/L) an automatic correction bolus; 160 to 180 mg/dL (8.9 to 10.0) basal increased; 112.5 to 160 mg/dL (6.3 to 8.9) programmed basal; below 112.5 mg/dL basal reduced; at or below 70 mg/dL (3.9) basal stopped.
- Automatic corrections: at most one per hour, 60 percent of the dose computed from the profile correction factor, with a fixed 110 mg/dL (6.1 mmol/L) target; the AGDT sheet adds a maximum of 6 units.
- Sleep activity: target 112.5 to 120 mg/dL and no automatic corrections. Exercise activity: 140 to 160 mg/dL.
- Active insulin time is fixed at 5 hours while Control-IQ is on.
- The algorithm also uses body weight and total daily insulin; the AGDT sheet says TDD is recalculated daily from the past 6 days.
- The active personal profile's basal, carb ratio and correction factor remain the inputs the loop works from, which is why they are still worth tuning.

Consequences for analysis:

- The scheduled basal is a starting point, not what was delivered. The useful basal signal is how far delivered basal drifts from scheduled basal in each time block, and in which direction, in periods without meals.
- The correction factor affects both manual and automatic corrections (PANTHER), so a weak or strong CF shows up after automatic boluses too.
- Post-meal insulin includes the meal bolus, any automatic corrections and any extra basal. A carb ratio that looks fine on glucose alone may be hiding loop compensation. The loop-cr-review project (section 4) is built on this idea and computes "extra basal" as the integral of delivered minus fasting basal over the post-meal window.

### 1.6 Rule-based review used in clinics

The PANTHER worksheet is the closest thing to a published, Control-IQ-specific rule set and maps well onto code:

- Check behaviour first: Control-IQ time in use above 90 percent, CGM inactive below 10 percent, sleep activity averaging 6 hours or more per day, and food boluses at least 50 percent of total insulin (otherwise assess missed meal boluses or weak carb ratios).
- Targets: TIR 3.9 to 10.0 mmol/L above 70 percent, TBR below 3.9 under 4 percent, TAR above 10.0 under 25 percent. If TBR is above 4 percent, fix hypoglycemia patterns first.
- Locate patterns: fasting or overnight; 1 to 3 hours after meals; lows that follow highs; highs that follow lows; around exercise; 1 to 3 hours after a correction.
- Suggested responses: change basal by 10 to 20 percent in the 1 to 2 hours before an overnight pattern; change carb ratio by 10 to 20 percent for post-meal patterns (example 1:10 to 1:12 to weaken, 1:10 to 1:8 to strengthen); weaken CF by 10 to 20 percent if lows occur 2 to 3 hours after a correction, strengthen it if highs persist 1 to 3 hours after one. The worksheet notes that stronger carb ratios are commonly needed with AID.
- It lists the most impactful settings in the order carb ratio, correction factor, basal.

For an overnight drift threshold, patient education material uses a change of more than 30 mg/dL (1.7 mmol/L) during a basal test as a sign the rate is off (https://diatribe.org/diabetes-management/beyond-basals-part-ii), and an Omnipod leaflet uses 2 mmol/L (https://www.omnipod.com/sites/default/files/CAN-41521-ENG-AWR10119-BasalTestingTool.pdf). These come from manual-pump basal tests; under Control-IQ the loop will damp drift, so drift and loop basal deviation have to be read together.

## 2. CGM analysis libraries

| Library | Language | License | Status | Fit for us |
|---|---|---|---|---|
| iglu (https://irinagain.github.io/iglu/, https://github.com/irinagain/iglu) | R | GPL-2 | v4.4.0, last push 2026-08-27 | Reference implementation to validate against; not runnable in a browser |
| iglu-py (https://pypi.org/project/iglu-py/) | Python wrapper over R via rpy2 | not stated on PyPI | v1.1.1 | Same as iglu, needs R installed |
| cgmquantify (https://github.com/brinnaebent/cgmquantify) | Python | MIT | v0.5 on PyPI, last push 2024-11-12 | README says Dexcom only; formulas reusable |
| GlucoStats (https://github.com/ai4healthurjc/GlucoStats) | Python | BSD-2-Clause | v1.0.0 on PyPI (2025-03-21), last push 2025-07-09, 11 commits | 59 features, windowing; early academic project |
| cgmanalysis (https://cran.r-project.org/package=cgmanalysis) | R | CC0 | v3.2.0, published 2026-03-25 | Reads Dexcom, iPro 2, Diasend, Libre, Carelink; Vigers et al. 2019, PLoS One, https://doi.org/10.1371/journal.pone.0216851 |
| Nightscout reports (https://github.com/nightscout/cgm-remote-monitor, `lib/report_plugins`) | JavaScript | AGPL-3.0 | last push 2026-10-27 | Day-to-day, daily stats, distribution, hourly stats, percentile, week-to-week, loopalyzer |
| Tidepool viz (https://github.com/tidepool-org/viz) | JavaScript | BSD-2-Clause | last push 2026-10-26 | Stats (TIR, CV, GMI, sensor usage, time in automation) in `src/utils/stat.js`, AGP code in `src/utils/agp/` |
| GlucoseIQ (https://github.com/marklearst/glucoseiq) | TypeScript | MIT | `@glucoseiq/core` 1.0.0-next.0 on npm, 1 star | Mean, GMI, TIR, AGP percentile bands, SVG output; generic CSV import; README states Node.js 24 or later |
| simple-statistics (https://github.com/simple-statistics/simple-statistics) | JavaScript | ISC | last push 2026-10-26 | Quantiles, k-means, regression; Nightscout's percentile report uses it |

Notes on the table:

- iglu covers about 50 metrics, listed at https://irinagain.github.io/iglu/articles/metrics_list.html: TIR and thresholds, CV, GMI, GRI, MAGE, CONGA, MODD, LBGI/HBGI, ADRR, rate of change, `episode_calculation` for hypo and hyper episodes, and `meal_metrics` (delta G, delta T, percent baseline recovery). Episode, postprandial and updated MAGE functions are described in Chun, Fernandes and Gaynanova 2024, Diabetes Technology and Therapeutics (https://doi.org/10.1089/dia.2024.0154). Because iglu is GPL-2, port formulas from the papers, not code, unless the dashboard is also GPL.
- The Nightscout percentile report computes the 10th, 25th, 50th, 75th and 90th percentiles per time bin (`percentile.js`). The glucose distribution report computes GVI, PGS and GMI. These percentiles differ from the AGP v5 bands below.
- I found no maintained, widely used npm package dedicated to CGM metrics. A search of the npm registry for CGM, AGP and glycemic-variability terms returned no such package besides GlucoseIQ.

### 2.1 Metric definitions to implement

- International consensus on time in range, Battelino et al. 2019, Diabetes Care 42(8):1593 to 1603 (https://pmc.ncbi.nlm.nih.gov/articles/PMC6973648/): recommend 14 days of data with CGM active 70 percent of the time. Targets for type 1: TIR 3.9 to 10.0 mmol/L above 70 percent; below 3.9 under 4 percent; below 3.0 under 1 percent; above 10.0 under 25 percent; above 13.9 under 5 percent; CV at or below 36 percent.
- AGP report v5.0 from the International Diabetes Center (https://www.agpreport.org/agp/agpreports): sections for time in ranges, glucose statistics and targets, the glucose profile, and daily glucose profiles. The profile shows the median, the middle 50 percent band, and 5th and 95th percentile lines. It also reports time in tight range 3.9 to 7.8 mmol/L (target above 50 percent), GMI, and CV.
- Glycemia Risk Index, Klonoff et al. 2023, J Diabetes Sci Technol 17(5):1226 to 1242: GRI = 3.0 x %veryLow + 2.4 x %low + 1.6 x %veryHigh + 0.8 x %high. I confirmed the formula only from secondary summaries (https://vitals.sutterhealth.org/new-diabetes-summary-score/); check the paper before shipping. iglu's `gri` is a second reference.
- CGM metrics for clinical trials, Battelino et al. 2023, Lancet Diabetes Endocrinol 11(1):42 to 57 (https://pubmed.ncbi.nlm.nih.gov/36493795/). Trial analysis plans citing it define a CGM hypoglycaemia episode as at least 15 consecutive minutes below the threshold (3.9 or 3.0 mmol/L), ending after 15 consecutive minutes at or above it (for example https://cdn.clinicaltrials.gov/large-docs/56/NCT05462756/SAP_001.pdf). The Hypo-METRICS paper notes that end criteria vary between guidelines (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12673437/).

## 3. Pattern detection methods

### 3.1 Hypo and hyper episodes

Use the 15-minute consensus rule above for level 1 and level 2 episodes, and the same structure for hyperglycaemia (above 10.0 and 13.9 mmol/L). iglu's `episode_calculation` implements this family of rules and is a good test oracle. For each episode, record start time, duration, nadir or peak, and context: time since last bolus, whether carbs were entered, whether an automatic correction preceded it, whether sleep activity was on. That context is what maps an episode onto the PANTHER pattern list.

### 3.2 Meal responses

- Per-meal features: pre-meal glucose, peak rise (delta G), time to peak (delta T), glucose at 2 and 4 hours, and return to baseline. iglu's `meal_metrics` defines delta G, delta T and percent baseline recovery.
- Loop-aware features for Control-IQ: automatic correction boluses and extra basal in the 4 hours after the meal. loop-cr-review (https://github.com/peisenh/loop-cr-review) defines extra basal as the integral of basal rate minus fasting basal over the post-meal window, with fasting basal taken from meal-free nights 00:00 to 06:00. Its README warns that this was built for CamAPS FX and that Control-IQ, which corrects partly with boluses, needs a different method.
- Clustering: Lubasinski et al. cluster meal responses in the OhioT1DM data and report clusters specific to both person and meal type, with carbohydrate amount alone not determining the cluster (JMIR Diabetes 2025, https://diabetes.jmir.org/2025/1/e68821/). Rehman et al. cluster meal events before predicting postprandial lows and highs (PLOS Digital Health 2025, https://pmc.ncbi.nlm.nih.gov/articles/PMC12440209). At three meals a day, 90 days gives roughly 270 meals, so a simple split by meal slot (breakfast, lunch, dinner, snacks) and outcome class is likely more readable than learned clusters.

### 3.3 Overnight drift

- Select nights with no carbs and no manual bolus in the previous 4 hours (the 4-hour washout is a design choice; the basal-testing guides above all ask for a fasting period before a test), split into hourly blocks, and measure glucose slope per block.
- Under Control-IQ, also measure the delivered-to-scheduled basal ratio and count suspensions per block. A block where the loop repeatedly raises basal while glucose still drifts up, or repeatedly suspends while glucose drifts down, is the strongest candidate for a basal discussion. This combination is my inference from the Control-IQ behaviour in section 1.5, not a published validated rule.
- Note the PANTHER advice to change the basal 1 to 2 hours before the pattern, and Autotune's equivalent spread over the 3 preceding hours.

### 3.4 Change-point detection ("things got worse after date X")

- PELT (Killick, Fearnhead and Eckley 2012, https://arxiv.org/abs/1101.1438) is a fast retrospective method for multiple change points. Bayesian online change-point detection (Adams and MacKay 2007, https://arxiv.org/abs/0710.3742) gives a per-step probability of a change.
- Evidence for these on CGM is thin. I found a pilot that used nonparametric change-point methods on CGM in pregnancy (https://ideas.repec.org/a/spr/metcap/v21y2019i3d10.1007_s11009-019-09716-6.html) and a 2025 preprint arguing that standard detectors flag clinically irrelevant shifts in glucose data (https://arxiv.org/abs/2509.01756).
- Practical approach: run change detection on daily or weekly aggregates (TIR, TBR, mean glucose, total daily insulin, carbs per day, automatic-bolus count), not on raw 5-minute data, and require a minimum effect size, for example a TIR shift of several percentage points sustained for at least 14 days to match the consensus window. Annotate detected dates with pump events from the export (settings changes, site changes, alarms).

### 3.5 Day clustering

- Hall et al. 2018, "Glucotypes reveal new patterns of glucose dysregulation", PLoS Biology (https://pmc.ncbi.nlm.nih.gov/articles/PMC6057684/), used spectral clustering on 2.5-hour windows, mostly in people without diabetes.
- Mao et al. 2022, Health Data Science (https://pmc.ncbi.nlm.nih.gov/articles/PMC10880155/), used 38 features, Box-Cox transforms, PCA and k-means with four clusters on 13-day intervals and named the clusters after review (well controlled, postprandial hyperglycaemia, fasting hypoglycaemia, high variability).
- For 90 days of one person, rule-based day labels are easier to explain than clusters: for example "good" (TIR at or above 70 and TBR under 4), "low day", "high day", "variable day" (CV above 36). k-means on a handful of daily features (TIR, TBR, TAR, CV, carbs, insulin, automatic-bolus count) can be offered as a secondary view, with a fixed small k.

## 4. Import paths for Glooko and Tandem exports

- Glooko ZIP export: GlookoDataWebApp (https://github.com/iricigor/GlookoDataWebApp, TypeScript, MIT, last push 2026-01-02) parses it in the browser. Its docs (`docs/DATA_UPLOAD.md`) describe a ZIP of CSV files named `{type}_data_{n}.csv` (for example `cgm_data_1.csv`), each with a metadata line first (name and date range), a header line second (example: `Timestamp`, `Glucose Value (mmol/l)`, `Manual Reading`, `Serial Number`), then data rows. Files of the same type are merged. Import detects English and German headers. Note: its optional AI analysis sends data to third-party providers.
- loop-cr-review (https://github.com/peisenh/loop-cr-review, Python, AGPL-3.0, last push 2026-10-27): reads Glooko/CamAPS FX ZIP exports, Nightscout dumps, LibreView and Dexcom Clarity CSV. It treats Control-IQ and Omnipod 5 as "Lite" mode only (no loop-derived values).
- glooko-reader (https://github.com/spamsch/glooko-reader, Python, MIT, last push 2026-03-29): unofficial client for the Glooko platform, described as retrieving Omnipod 5 data. Not an export parser.
- cgmanalysis reads Diasend files; whether that matches current Glooko CSV columns is untested.
- tconnectsync (https://github.com/jwoglom/tconnectsync, Python, MIT, last push 2026-10-05, 181 stars): syncs Tandem Source data to Nightscout through Tandem's undocumented API. It uploads basal, bolus, pump events (alarms, suspend and resume, site changes, sleep and exercise), profiles, and optionally CGM. This is the route to Nightscout and therefore to Autotune, if ever wanted.
- tandem-source-sync (https://github.com/nickhart/tandem-source-sync, TypeScript, MIT, last push 2025-12-21, 0 stars): a Next.js app for exporting Tandem Source data. Early stage.
- tandem-pump-data-parser (https://github.com/ricealexander/tandem-pump-data-parser, JavaScript, no license, last push 2020-01-13): converts the old t:connect CSV export to JSON. Unmaintained and not reusable without a license.
- Tidepool uploader (https://github.com/tidepool-org/uploader, BSD-2-Clause) supports Control-IQ pumps; Tidepool's support pages say CGM data from the t:slim X2 is uploaded with the pump data (https://support.tidepool.org/hc/en-us/articles/360029369132).
- I found no public documentation of a Tandem Source CSV export layout.

Questions to settle against a real export before building the attribution step: whether `basal_data` rows carry the actual delivered rate under Control-IQ or only scheduled segments, whether automatic correction boluses are marked separately from manual boluses in `bolus_data`, and whether sleep and exercise activity periods appear anywhere in the export. `docs/export-format.md` records what the Glooko export shows on each point.

## 5. Recommendation

Implement in TypeScript, in the browser, in three layers.

1. Import and metrics. Parse the Glooko ZIP client-side (structure as documented by GlookoDataWebApp; MIT, so its parser can be studied or adapted). Compute the consensus metrics, GRI, AGP v5 bands (5/25/50/75/95 percentiles), and data sufficiency (14 days, 70 percent active) per 14-day window. Write the formulas from the papers and validate the numbers against iglu or cgmanalysis offline on the same data. Tidepool viz (BSD-2-Clause) is a permissive JavaScript reference for TIR, CV, GMI and time in automation.
2. Pattern rules. Encode the PANTHER worksheet: behaviour checks first (Control-IQ use, CGM wear, food-bolus share of total insulin, sleep activity), then the "TBR above 4 percent means fix lows first" gate, then episode detection with the 15-minute rule, tagged by context (overnight, 1 to 3 hours post-meal, 2 to 3 hours post-correction, rebound). Each finding names a time block and a setting and states the PANTHER range of 10 to 20 percent as the size to discuss, never a new value to program.
3. Simplified Autotune-style attribution adapted to Control-IQ. Port oref0's deviation formula (MIT, with notice) using actual delivered insulin (all boluses including automatic ones, delivered basal) and a 5-hour insulin action time to match the pump. Bucket points into meal, correction and fasting windows. Report per time block: median deviation, delivered-to-scheduled basal ratio, suspension minutes, and for meals the effective carb ratio (carbs divided by bolus plus automatic corrections plus extra basal over 4 hours) next to the programmed ratio. Show the direction and confidence (number of qualifying days), not a computed setting.

What to avoid:

- Running stock oref0 Autotune on Control-IQ data and presenting its numbers. It assumes scheduled-plus-temp basal semantics, a single ISF and carb ratio, and nightly 20 percent steps; none of this matches Control-IQ, and I found no validation on Tandem data.
- Copying GPL or AGPL code (iglu, Nightscout, AndroidAPS, loop-cr-review, Nighttune) into the dashboard unless the dashboard takes the same license. Reimplement from the published definitions.
- Fitted or machine-learned settings models (Tune-style optimization, clustering-driven advice) as the primary output. With one person and 90 days they are hard to explain, and the published decision-support work (Advisor Pro) caps changes and was trialled under clinician supervision.
- Correction-factor conclusions from data dominated by automatic corrections. Use only isolated manual corrections without carbs, and say so in the UI.
- Sending data to external AI services by default. GlookoDataWebApp offers this, but a minor's health data should stay in the browser.
