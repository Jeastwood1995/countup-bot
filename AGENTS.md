# AGENTS.md — CountUp Discord Bot

This document provides system context, technical architecture, invariants, and guidelines for autonomous AI agents (such as Google Antigravity, Claude Code, Cursor, or Codex) working within this repository.

---

## 1. System Overview
`countup-bot` is a serverless Discord application hosted on **Cloudflare Workers** with **Cloudflare D1** persistence. It provides:
* `/countup`: Computes days elapsed since a user-supplied date (e.g., relationship milestones, project launches, quit-smoking trackers) and displays the count alongside Discord's native client-rendered relative timestamps.
* `track: True`: Automatically recalculates and edits the message daily at midnight (00:00 UTC) via Cloudflare Cron Triggers.
* `/countup-track-existing`: Links and immediately recalculates an existing countup message into an automated tracker.
* `/countup-sync`: On-demand manual trigger to recalculate all active trackers in the database.
* `/countup-list` & `/countup-untrack`: Server-scoped tracker management.

---

## 2. Technical Architecture & Stack
* **Runtime**: Cloudflare Workers (V8 Edge Isolates).
* **Database**: Cloudflare D1 (Serverless SQLite at the edge).
* **Cron / Scheduler**: Cloudflare Cron Triggers (`0 0 * * *` at 00:00 UTC).
* **Architecture Pattern**: **HTTP REST Interactions Only**.
  * **CRITICAL INVARIANT**: There is **no** persistent WebSocket connection (Gateway API). Never attempt to use long-polling or persistent clients like `discord.js Client` or `discord.py` bot runners.
* **Language**: TypeScript (`ES2022`, strict typing, module resolution Bundler).
* **Cryptography**: `discord-interactions` (`verifyKey` via Ed25519 public-key signature verification).
* **Types**: `@cloudflare/workers-types` and `discord-api-types/v10`.
* **Deployment & Local Tooling**: Cloudflare `wrangler` CLI.

---

## 3. Repository Layout
```text
countup-bot/
├── AGENTS.md                     # Agent instruction and codebase context (this file)
├── README.md                     # Developer quickstart and human setup guide
├── package.json                  # Project scripts and dependencies
├── tsconfig.json                 # TypeScript configuration targeting Worker isolates
├── wrangler.toml                 # Cloudflare Workers configuration (D1, cron, vars)
├── .dev.vars.example             # Example local environment variable file
├── .dev.vars                     # Local environment secrets (IGNORED BY GIT)
├── .gitignore                    # Git ignore rules
└── src/
    ├── db/
    │   └── schema.sql            # D1 SQLite schema (trackers table DDL only)
    ├── types/
    │   ├── env.ts                # Cloudflare environment interface
    │   ├── tracker.ts            # Tracker entity, NewTracker DTO & ITrackerRepository
    │   ├── milestone.ts          # MilestoneCalculation & ICountupService
    │   ├── discord.ts            # Discord API types, EditMessageResult & IDiscordService
    │   ├── jobs.ts               # UpdateJobResult interface
    │   └── index.ts              # Barrel re-export for clean imports
    ├── repositories/
    │   └── tracker.repository.ts # TrackerRepository (Data access layer for D1 SQLite)
    ├── services/
    │   ├── countup.service.ts    # CountupService (Pure domain calculations & markdown)
    │   ├── discord.endpoints.ts  # DiscordEndpoints (Type-safe Discord REST route builder)
    │   ├── discord.service.ts    # DiscordService (Discord REST API client with retries)
    │   └── tracker.service.ts    # TrackerService (Orchestrator for tracking workflows)
    ├── index.ts                  # Controller: Ed25519 verification, routing & cron orchestrator
    └── register.ts               # CLI script to register slash commands with Discord API
```

---

## 4. Key Agent Workflows & Commands

All commands must be executed within `C:\Users\Jumpi\Documents\dev-projects\discord_apps\countup-bot`:

* **Install Dependencies**:
  ```bash
  npm install
  ```
* **Verify Types (Static Analysis)**:
  ```bash
  npm run typecheck
  ```
* **Run Database Migrations**:
  ```bash
  npx wrangler d1 execute countup-db --remote --file=./src/db/schema.sql
  ```
* **Run Local Worker**:
  ```bash
  npm run dev
  ```
  Starts the local worker at `http://localhost:8787`.
* **Register Slash Commands**:
  ```bash
  npm run register
  ```
  Reads `.dev.vars` / `.env` and issues a `PUT` request to Discord's REST API (`/applications/{id}/commands` or guild commands).
* **Deploy to Production**:
  ```bash
  npm run deploy
  ```

---

## 5. Architectural Invariants for Agents

### A. Ed25519 Cryptographic Verification
* Every single request received by `src/index.ts` must be validated using `verifyKey(...)` against `env.DISCORD_PUBLIC_KEY`.
* Discord validates that endpoints reject unsigned requests with `401 Unauthorized`.
* Never remove or bypass `verifyKey`, or the Discord Developer Portal will refuse to accept the Interactions Endpoint URL.

### B. Discord PING / PONG Handshake
* When setting up or modifying the Interactions URL, Discord sends an `InteractionType.PING (1)`.
* The application must immediately return `{ type: InteractionResponseType.PONG (1) }` with `Content-Type: application/json`.

### C. 3-Second Interaction Timeout
* Discord requires an initial response within **3 seconds** of receiving an interaction.
* All background tasks (such as retrieving original message IDs or writing to D1) MUST be deferred via `ctx.waitUntil(...)` after returning the 200 OK response.

### D. Scheduled Cron & Message Updates
* The `scheduled(...)` handler is invoked by Cloudflare Cron at 00:00 UTC.
* Because interaction tokens expire after 15 minutes, long-term message editing MUST use Discord's REST API with `Authorization: Bot ${env.DISCORD_BOT_TOKEN}` via `PATCH /channels/{channel_id}/messages/{message_id}`.
* If Discord returns `404` (message deleted) or `403` (missing permissions), the worker MUST prune the tracker from D1.

### E. Error Handling & Privacy
* Date parsing errors, future-date notifications, and tracker listings (`/countup-list`, `/countup-untrack`) must use ephemeral message flags (`flags: 64`), ensuring that only the executing user sees the message.

---

## 6. Secrets & Environment Variables
The application requires three keys obtained from the [Discord Developer Portal](https://discord.com/developers/applications):
* `DISCORD_APPLICATION_ID`: Used by `src/register.ts` and `src/index.ts` to identify the application.
* `DISCORD_PUBLIC_KEY`: Used by `src/index.ts` to verify Ed25519 request signatures.
* `DISCORD_BOT_TOKEN`: Used by `src/register.ts` and `src/index.ts` scheduled handler to edit Discord messages.
* `DISCORD_GUILD_ID` *(Optional)*: If provided in `.dev.vars`, registers commands for a specific guild for instant updates rather than waiting for global propagation.
