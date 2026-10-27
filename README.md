# Rangebook

Rangebook is a local dashboard for CGM and Tandem Control-IQ pump data exported from Glooko. It is written for teenagers with type 1 diabetes and their families: it shows time in range, a typical day, a week map and patterns, and turns patterns into questions for the care team. It runs on your own machine and has no login. Nothing is sent anywhere unless you connect the optional MCP server to Claude.

Rangebook is not a medical device. It does not give dosing advice, and its output is not a basis for changing pump settings without the care team.

Stack: TanStack Start (Router, Query, Form, Table, Store), shadcn/ui, Drizzle ORM and Postgres 18 in Docker.

## Run it

```bash
cp .env.example .env.local
```

```bash
docker compose up -d
```

```bash
pnpm install
```

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

Open http://localhost:3000/people, add a person, then drop the export zip on http://localhost:3000/import. Postgres listens on port 5433 (user, password and database are all `cgm`), set in `.env.local`.

### Try it with made-up data

`scripts/demo-export.ts` writes a Glooko-style export for a person who does not exist. The glucose curve comes from a small simulation of meals, insulin and a Control-IQ-like controller, with a settings change halfway through, pump stops and sensor gaps, so the patterns page has something to find. It is not a physiological model.

```bash
pnpm demo:export
```

This writes `demo-export.zip` (90 days ending today). Drop it on the import page. `--days`, `--end YYYY-MM-DD`, `--seed`, `--name` and `--out` change the defaults. A different `--seed` and `--name` gives a second made-up person.

## People

Every import belongs to a person, so a family with more than one child keeps each child's data apart. Pick the person in the menu at the top of the sidebar (the round initial on a phone); the choice is stored in a cookie and every page, goal, sharing setting and saved question follows it. Add, rename and delete people on the People page. Deleting a person deletes their imports and saved questions.

## Import

The export zip holds CSV files such as `cgm_data_1.csv`, `bolus_data_1.csv` and `basal_data_1.csv`. The parser in `src/lib/glooko/` reads them from a zip or as loose CSV files. CGM sentinel values (0.1 for LOW, 111.1 for HIGH) are stored as 2.2 and 22.2 with `sensor_limit` set.

Each import keeps its own rows. Imports can overlap, for example a weekly 90-day export: inside the time span of an import, its rows replace those of any import whose data ends earlier. That also replaces the cut-off last day of an older export with the complete day from a newer one. Deleting an import on the import page removes only its rows, and older imports covering the same days show through again.

The first line of every export holds the patient's name. Rangebook stores it with the import and warns before storing an export whose name does not match the person's earlier exports, or matches another person.

Pump timestamps are local wall-clock time without a zone and are stored as `timestamp without time zone`.

## In-app chat (optional)

The chat at `/ask` answers questions about the person selected in the app. It runs on TanStack AI through OpenRouter and gets the same tools as the MCP server below: the app does the calculations and the model explains them. It follows the same rules: numbers only from tools, lows first, no doses, setting values or directions, and the care plan for anything happening right now.

The chat is off until you add an OpenRouter key. Everything else works without it, and the chat pages show how to turn it on:

1. Create a key at https://openrouter.ai/keys. Each question costs a little, paid to OpenRouter.
2. Add `OPENROUTER_API_KEY="sk-or-..."` to `.env.local`.
3. Restart `pnpm dev`.

Pick the model and whether the chat may read single days in Ask settings (`/more/chat`). Your question and the numbers the tools return are sent through OpenRouter to the model's company; each request asks for providers that do not store or train on data. The export name is never sent, and chats are stored only in the local database.

To try the screens without a key or credits, start the dev server with `RANGEBOOK_FAKE_CHAT=1`. A scripted model then calls the real tools on the local database and nothing leaves the computer.

Tests: `pnpm test` runs without network, database or key. `pnpm test:live` calls OpenRouter with made-up data and spends a little credit.

## Ask Claude about the data (MCP)

`src/mcp/` is a local MCP server over stdio. It reads the same Postgres database and runs the same analysis code as the dashboard, so Claude gets the same numbers. It needs Postgres running and at least one import; the web app does not have to run.

`pnpm mcp` builds the view in `mcp-app/` and starts the server. `.mcp.json` registers it for Claude Code in this folder, so start `claude` here and approve the `rangebook` server when asked.

For Claude Desktop, add this to `~/Library/Application Support/Claude/claude_desktop_config.json` and restart Claude Desktop:

```json
{
  "mcpServers": {
    "rangebook": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/path/to/rangebook", "mcp"],
      "env": { "DATABASE_URL": "postgresql://cgm:cgm@localhost:5433/cgm" }
    }
  }
}
```

Replace `/path/to/rangebook` with the folder you cloned into. Claude Desktop starts servers with a short `PATH`, so if node is installed with nvm or similar, the server fails with "node: not found"; add a `PATH` entry to `env` with the folders of node and pnpm. The Ask Claude page in the app (http://localhost:3000/ask-claude) builds this config with the right paths for your computer, with steps for Claude Code too. With more than one person stored, every tool takes a `person` argument (a name or id from `list_people`). To fix the server to one person, add `"RANGEBOOK_PERSON": "Name"` to `env`.

If Claude Desktop cannot find `pnpm`, use the full path from `which pnpm` as `command`.

Tools:

| Tool | What it returns |
| --- | --- |
| `list_people` | People with stored data and their data range |
| `get_overview` | Data range, targets, whole-period and last-14-day summaries, what the export lacks |
| `get_period_summary`, `compare_periods` | Consensus metrics for one period, or two periods and the change |
| `get_hourly_profile`, `get_week_map` | Typical day by hour, weekday by hour shares |
| `get_patterns` | Rule-based findings with evidence and a question for the care team |
| `get_meal_responses` | Glucose at each carb bolus, change at 2 hours, lows within 4 hours |
| `list_days`, `get_day`, `list_events` | Day summaries, one day in detail, lows, very lows, sensor-high runs, pump stops |
| `get_system_check`, `get_glossary` | Wear, carb entries, automatic share, pump stops; fixed term explanations |
| `list_saved_questions`, `save_question_for_clinic` | The clinic list on the Patterns page (the only write) |
| `show_week_summary`, `show_typical_day`, `show_patterns`, `show_day` | Same data as an interactive view (MCP Apps) |

Prompts: `weekly_review`, `clinic_prep` and `explain_day`.

The `show_*` tools use the MCP Apps extension. Claude Desktop and claude.ai render them as charts and cards in the chat, and the patterns view can save questions for clinic. Claude Code in a terminal gets the same data as text.

The server instructions tell Claude to take every number from a tool, to frame findings as questions for the care team and never to suggest doses, setting values or which way a setting should change. The tools never return the patient name.

Privacy: the server runs locally, but whatever a tool returns is sent to Anthropic as part of the conversation, the same as anything typed into Claude. Tools return summaries; `get_day` and `show_day` return one day's readings.

## Data

`data/` and `*.zip` are git-ignored. Do not commit export files: the first line of every CSV holds the patient's full name, and the rows are health data.

## Docs

- `docs/export-format.md`: the files and columns in a Glooko export from a Tandem pump, and what the export does not contain
- `docs/research/`: clinical rules, algorithms, LLM agent design and teen UX research

## License

MIT. See `LICENSE`.
