# Glooko export format for Tandem t:slim X2 with Control-IQ

This document describes the CSV export that Glooko produces for a Tandem t:slim X2 pump running Control-IQ, with CGM data read through the pump. It covers file layout, columns, encoded values and the quirks that matter for ingestion and analysis. All example rows are made up. The pump serial in the examples is `0000000`.

Units are mmol/L for glucose, grams for carbohydrate and units (U) for insulin.

## Files and folders

The export is a set of CSV files in a root folder with two subfolders:

```
cgm_data_1.csv
cgm_data_2.csv              (only when the CGM series overflows file 1)
bg_data_1.csv
cgm_carbs_data_1.csv
alarms_data_1.csv
Insulin data/
  insulin_data_1.csv
  basal_data_1.csv
  bolus_data_1.csv
Manual data/
  exercise_data_1.csv
  manual_insulin_data_1.csv
  notes_data_1.csv
  food_data_1.csv
  medication_data_1.csv
```

File names follow the pattern `{type}_data_{n}.csv`. Files of the same type form one series and must be merged.

## Common file format

- Every file starts with a UTF-8 byte order mark (EF BB BF).
- Line 1 is metadata: `Name:<full name>,Date Range:YYYY-MM-DD - YYYY-MM-DD`. It holds the patient's full name. Ingestion must drop or hash this line and must never store the name.
- Line 2 is the header row.
- Line endings are LF. Fields are comma separated with no quoting.
- Timestamps are `YYYY-MM-DD HH:MM` in pump local time, with no seconds and no timezone. Rows are sorted newest first.
- Numbers use a dot as decimal separator. Missing values are empty strings.
- `Serial Number` is the pump serial in every file, including the CGM files, because the CGM data is read through the pump.
- Because timestamps carry no timezone, daylight saving changes and pump clock changes cannot be detected from the data alone. A clock change that falls inside a CGM gap leaves no visible trace.

## cgm_data_N.csv

Columns: `Timestamp`, `CGM Glucose Value (mmol/l)`, `Serial Number`.

One row per CGM reading, normally every 5 minutes.

- Sentinel values: `0.1` encodes the sensor's LOW reading (below 2.2 mmol/L) and `111.1` encodes HIGH (above 22.2 mmol/L). Real readings fall between 2.2 and 22.2. Store the sentinels as LOW and HIGH flags, not as numbers. For means and percentiles, a common choice is to substitute 2.2 and 22.2.
- Row cap: `cgm_data_1.csv` holds at most about 20,000 rows, the newest readings. Older readings continue in `cgm_data_2.csv`, and a longer export may produce more files. The files do not overlap.
- Sampling: most intervals are exactly 5 minutes. After a sensor change the reading minute shifts (for example from 0 to 2 minutes past each 5-minute mark), so some intervals are 2 to 4 or 6 to 7 minutes.
- Gaps: sensor changes, warm-up and lost connection produce gaps from minutes to days. Days without any CGM can occur.

```
Timestamp,CGM Glucose Value (mmol/l),Serial Number
2026-01-14 08:05,7.4,0000000
2026-01-14 08:00,111.1,0000000
2026-01-14 07:55,21.8,0000000
2026-01-13 03:10,0.1,0000000
```

## bg_data_1.csv

Columns: `Timestamp`, `Glucose Value (mmol/l)`, `Manual Reading` (always `M`), `Serial Number`.

Despite the `M` flag, this file is mainly not fingerstick readings. Most rows share the exact minute of a bolus and equal a CGM reading from a few minutes earlier. The file is best read as "glucose value entered or accepted in the bolus calculator". Some rows may be real meter readings, but no field tells them apart. Exact duplicate rows can occur.

```
Timestamp,Glucose Value (mmol/l),Manual Reading,Serial Number
2026-01-14 12:30,6.8,M,0000000
2026-01-14 07:15,11.2,M,0000000
```

## cgm_carbs_data_1.csv

Columns: `Timestamp`, `Carbs (g)`. This file can be header only. Carbohydrate entries from the pump's bolus calculator appear in the bolus file instead.

## alarms_data_1.csv

Columns: `Timestamp`, `Alarm/Event`, `Serial Number`.

Event names seen in this export type:

- `tandem_controliq_high`
- `tandem_controliq_low`
- `tandem_cgm_unavailable`
- `Low Power Alert (2T)`
- `Low Power Alert (3T)`
- `Cartridge Loaded`
- `Empty Cartridge Alarm (8A)`
- `Resume Pump Alarm (18A)`

Other pump models or software versions may produce other names. Exact duplicate rows can occur, and two different events can share a timestamp. `Cartridge Loaded` is the closest thing to a site or cartridge change record; the export has no explicit infusion set or sensor change event.

```
Timestamp,Alarm/Event,Serial Number
2026-01-14 15:20,tandem_controliq_low,0000000
2026-01-14 09:02,Cartridge Loaded,0000000
2026-01-13 23:40,Empty Cartridge Alarm (8A),0000000
```

## Insulin data/insulin_data_1.csv

Columns: `Timestamp`, `Total Bolus (U)`, `Total Insulin (U)`, `Total Basal (U)`, `Serial Number`.

One row per day with the pump's own daily totals, stamped at 23:58 or 23:59. The last day of the export is partial and stamped at the export time. The first day can also be partial if the other files start mid-day.

- `Total Insulin` equals `Total Basal` plus `Total Bolus` to within rounding.
- `Total Bolus` matches the sum of the bolus file for the same day.
- `Total Basal` can be far below the sum of rate times duration from the basal file on days with a cartridge change. On other days the two agree closely. Treat this file as the pump's figure for daily insulin, and flag days where it disagrees with the basal rows.

```
Timestamp,Total Bolus (U),Total Insulin (U),Total Basal (U),Serial Number
2026-01-14 23:59,18.4,37.1,18.7,0000000
2026-01-13 23:58,21.05,33.25,12.2,0000000
```

## Insulin data/basal_data_1.csv

| Column | Content |
|---|---|
| Timestamp | Start of a basal segment. |
| Insulin Type | `Scheduled` or `Suspend`. No `Temp` rows appear under Control-IQ. |
| Duration (minutes) | Length of the segment, 1 to 1,440. The next segment normally starts where this one ends, sometimes off by one minute. |
| Percentage (%) | Always empty. |
| Rate | Delivery rate in U/h. |
| Insulin Delivered (U) | Always empty. Compute delivered insulin as rate x duration / 60. |
| Serial Number | Pump serial. |

How to read the rows:

- `Scheduled` covers both the profile basal and Control-IQ modulation. Control-IQ adjusts basal on a 5-minute cycle, so most rows are short segments of 4 or 5 minutes with irregular rates (for example 1.27 or 0.462). A long segment at a round rate (for example 0.8 for several hours) means the pump delivered the profile basal.
- `Scheduled` with rate 0.0 is Control-IQ stopping basal because of a predicted low.
- `Suspend` rows have rate 0.0 and mark pump suspensions, usually around cartridge changes and alarms. Some last several hours.
- On days without CGM, Control-IQ cannot run, and the pump delivers the profile basal. These days show up as very long segments, up to a full day of 1,440 minutes.
- The export splits a segment at midnight and adds a 1-minute row at 00:00, so a timestamp can appear twice. A 1-minute `Scheduled` row can also sit next to a `Suspend` row at the same time. Drop these 1-minute rows when computing rate statistics.

```
Timestamp,Insulin Type,Duration (minutes),Percentage (%),Rate,Insulin Delivered (U),Serial Number
2026-01-14 10:15,Scheduled,5,,1.27,,0000000
2026-01-14 10:10,Scheduled,5,,0.0,,0000000
2026-01-14 09:02,Suspend,14,,0.0,,0000000
2026-01-13 00:00,Scheduled,1,,0.8,,0000000
```

## Insulin data/bolus_data_1.csv

| Column | Content |
|---|---|
| Timestamp | Time of the bolus. |
| Insulin Type | `Normal`. No extended boluses appeared in this export type. |
| Blood Glucose Input (mmol/l) | Glucose value attached to the bolus. 0.0 means no value was entered. On user boluses this is the calculator BG, often an accepted CGM value. On automatic boluses it is the value Control-IQ acted on, which often differs from the latest CGM reading and fits Control-IQ's 30-minute predicted glucose. |
| Carbs Input (g) | Carbs entered in the calculator, 0.0 when none. Non-zero values are multiples of 5 g. |
| Carbs Ratio | Grams per unit from the active profile. Filled on only some rows. |
| Insulin Delivered (U) | Units delivered. |
| Initial Delivery (U), Extended Delivery (U) | Always empty. |
| Serial Number | Pump serial. |

The file has no column that says whether a bolus was a meal bolus, a manual correction or a Control-IQ automatic correction. It also lacks the calculator's food and correction split, insulin on board, target and override flag. A heuristic classification that works on this export:

1. Carb bolus: `Carbs Input` > 0.
2. Control-IQ automatic correction: carbs 0, BG input > 0, no carb ratio, and no matching row in `bg_data_1.csv`.
3. Manual bolus without carbs: everything else (carbs 0, with either no BG, a carb ratio, or a matching BG-file row).

Checks that support the rule: automatic boluses should have a BG input of about 10.0 or more (the Control-IQ trigger), follow each other at most once per hour, and not occur during Sleep activity. Manual no-carb boluses often have round amounts such as 1.0 or 2.0 U. The rule is a heuristic and should be validated against Tandem t:connect data, which marks automatic boluses explicitly.

```
Timestamp,Insulin Type,Blood Glucose Input (mmol/l),Carbs Input (g),Carbs Ratio,Insulin Delivered (U),Initial Delivery (U),Extended Delivery (U),Serial Number
2026-01-14 12:30,Normal,6.8,40.0,,4.21,,,0000000
2026-01-14 11:05,Normal,11.6,0.0,,0.912,,,0000000
2026-01-14 07:40,Normal,0.0,0.0,9.0,2.0,,,0000000
```

The rows above are, in order, a carb bolus, an automatic correction and a manual bolus without carbs.

## Manual data files

These files hold data entered by hand in the Glooko app. They can contain only the metadata line and the header.

| File | Columns |
|---|---|
| exercise_data_1.csv | Timestamp, Name, Intensity, Duration (minutes), Calories Burned |
| manual_insulin_data_1.csv | Timestamp, Name, Value, Insulin Type |
| notes_data_1.csv | Timestamp, Value |
| food_data_1.csv | Timestamp, Name, Carbs (g), Fat, Protein, Calories, Serving Quantity, Number of Servings |
| medication_data_1.csv | Timestamp, Name, Value, Medication Type |

## Inferring profile changes

The export has no settings file, but parts of the active profile can be reconstructed:

- Basal rate: long `Scheduled` segments at a round rate show the profile basal for that time of day. A change in that rate from one day to the next marks a profile change or a profile edit.
- Carb ratio: the `Carbs Ratio` column shows the ratio when it is filled. Carb boluses entered without a BG value, where units equal carbs divided by ratio exactly, confirm it. Changes in the ratio over time or by time of day show carb ratio segments, though not their exact boundaries.

The correction factor (ISF) and target cannot be reconstructed, because the calculator subtracts insulin on board and the export does not include it.

## What the export does not contain

1. Pump settings: basal schedule, carb ratio schedule, correction factor (ISF), Control-IQ target, insulin duration, maximum bolus, personal profile names and the history of which profile was active when.
2. Bolus detail: no flag for automatic versus user boluses, no food and correction split, no insulin on board, no override flag.
3. Control-IQ activity modes: Sleep and Exercise schedules and manual activations are absent. Their effect can sometimes be seen indirectly, for example as hours with no automatic boluses.
4. Infusion set and sensor change records. `Cartridge Loaded` events exist, and sensor changes can be estimated from CGM gaps and the shift in reading minute.
5. CGM device model. Only the LOW and HIGH limits of 2.2 and 22.2 mmol/L hint at it.
6. Timezone.
7. Body weight and total daily insulin as entered on the pump.
8. Ketone readings.

A Tandem t:connect or Glooko device settings report holds the settings. The t:connect CSV or Therapy Timeline export holds the bolus detail.

## Notes for ingestion

- Read files as UTF-8 with BOM handling (`utf-8-sig`), skip line 1, and parse line 2 as the header.
- Never store the name from line 1.
- Merge all `cgm_data_*.csv` files into one series.
- Map CGM `0.1` to LOW and `111.1` to HIGH. Do not average them as raw numbers.
- Treat always-empty columns (`Percentage (%)` and `Insulin Delivered (U)` in basal, `Initial Delivery (U)` and `Extended Delivery (U)` in bolus) as absent, not zero.
- Drop exact duplicate rows in the BG and alarm files, and the 1-minute midnight split rows in the basal file when computing rate statistics.
