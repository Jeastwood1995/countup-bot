# ⏳ CountUp Discord Bot

A serverless Discord bot built with **TypeScript**, **Cloudflare Workers**, and **Cloudflare D1** that tracks and celebrates days elapsed since special milestones, dates, or memories!

---

## ✨ Features
* **Custom Milestone Label**: Add an optional label like `First Date`, `Anniversary`, or `Quit Smoking`.
* **Dynamic Client-side Timestamps**: Leverages Discord's `<t:UNIX:R>` tags so Discord dynamically displays "X days ago" in real-time.
* **Auto-Updating Live Trackers (Cloudflare D1 + Cron Triggers)**: Pass `track: True` to automatically recalculate and edit the milestone message every day at midnight (00:00 UTC).
* **Tracker Management**: Use `/countup-list` to see all active trackers in your server, and `/countup-untrack` to remove any tracker.
* **100% Serverless**: Runs on Cloudflare Workers edge network with virtually zero cold-start delay and no 24/7 server running costs.
* **Secure by Design**: Full Ed25519 cryptographic signature verification on every interaction.

---

## 💻 Slash Commands

| Command | Description |
| :--- | :--- |
| `/countup date: YYYY-MM-DD [label] [track] [image] [image2] [image3] [image4]` | Calculate elapsed days. Supports up to 4 photos rendered in a Discord collage gallery. Set `track: True` to auto-update daily at 00:00 UTC. |
| `/countup-track-existing message_id: <ID> date: YYYY-MM-DD [label] [image] [image2] [image3] [image4]` | Convert an existing countup message into a tracked milestone and update it immediately with optional images. |
| `/countup-sync` | Manually trigger daily recalculation on all tracked messages right now. |
| `/countup-list` | List all active automated trackers in the server with direct links to messages. |
| `/countup-untrack message_id: <ID>` | Stop automatic daily updates for a milestone message. |

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Credentials
Copy `.dev.vars.example` to `.dev.vars`:
```bash
cp .dev.vars.example .dev.vars
```
Fill in the values from your [Discord Developer Portal](https://discord.com/developers/applications):
* `DISCORD_APPLICATION_ID`
* `DISCORD_PUBLIC_KEY`
* `DISCORD_BOT_TOKEN`
* `DISCORD_GUILD_ID` *(Optional, for instant server-specific command testing)*

### 3. Initialize Cloudflare D1 Database
Create the database and apply the schema:
```bash
npx wrangler d1 create countup-db
npx wrangler d1 execute countup-db --remote --file=./src/db/schema.sql
npx wrangler d1 execute countup-db --local --file=./src/db/schema.sql
```
*(If upgrading an existing database, run `npx wrangler d1 execute countup-db --remote --command="ALTER TABLE trackers ADD COLUMN image_urls TEXT;"`)*


### 4. Register Slash Commands
Publish commands to Discord:
```bash
npm run register
```

### 5. Local Development & Testing
Start the local worker:
```bash
npm run dev
```
In another terminal, expose your local worker (`http://localhost:8787`) to the internet using ngrok:
```bash
npx ngrok http 8787
```
Copy the public `https://*.ngrok-free.app` URL, go to your Discord App's **General Information** tab, and paste it into **Interactions Endpoint URL**.

### 6. Automated Deployment & CI/CD (GitHub Actions)
Deployments and Discord slash command registrations run automatically whenever code is pushed to the `main` branch via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

#### Required GitHub Secrets
In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions** and add the following repository secrets:
* `CLOUDFLARE_API_TOKEN`: Cloudflare API token created with the **Edit Cloudflare Workers** template.
* `CLOUDFLARE_ACCOUNT_ID` *(Optional / Recommended)*: Your Cloudflare Account ID from the Workers & Pages dashboard sidebar.
* `DISCORD_APPLICATION_ID`: Your Discord Application ID.
* `DISCORD_BOT_TOKEN`: Your Discord Bot Token.
* `DISCORD_GUILD_ID` *(Optional)*: Set to register slash commands instantly to a single test guild instead of globally.

#### One-Time Cloudflare Worker Secrets Setup
Ensure your runtime secrets are stored in Cloudflare (persists across all subsequent automated CI/CD deployments):
```bash
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put DISCORD_APPLICATION_ID
```

#### Manual / Local Deployment
You can also deploy manually at any time using:
```bash
npm run deploy
```

Copy your production `https://countup-bot.<your-subdomain>.workers.dev` URL and set it as your **Interactions Endpoint URL** in the Discord Developer Portal!
