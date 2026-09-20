import dotenv from 'dotenv';
import path from 'path';
import { DiscordEndpoints } from './services/discord.endpoints';

// Load variables from .dev.vars or .env
dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
dotenv.config();

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!APPLICATION_ID || !BOT_TOKEN) {
  console.error('❌ Error: Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN.');
  console.error('Please configure these in your .dev.vars file before running this script.');
  process.exit(1);
}

const COMMANDS = [
  {
    name: 'countup',
    description: 'Calculate how many days have passed since a specific date',
    options: [
      {
        name: 'date',
        description: 'The starting date (format: YYYY-MM-DD)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'label',
        description: 'Optional name for this memory (e.g. First Date, Anniversary, Moved In)',
        type: 3, // STRING
        required: false,
      },
      {
        name: 'track',
        description: 'Automatically recalculate and update this message daily at midnight (UTC)',
        type: 5, // BOOLEAN
        required: false,
      },
    ],
  },
  {
    name: 'countup-track-existing',
    description: 'Track and auto-update an existing countup message in this channel',
    options: [
      {
        name: 'message_id',
        description: 'The Message ID of the existing countup message',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'date',
        description: 'The starting date (format: YYYY-MM-DD)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'label',
        description: 'Optional name for this memory (e.g. BTS live with honey)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'countup-sync',
    description: 'Manually trigger recalculation and update all active trackers right now',
  },
  {
    name: 'countup-list',
    description: 'List all active daily milestone trackers in this server',
  },
  {
    name: 'countup-untrack',
    description: 'Stop automatically recalculating a tracked milestone message',
    options: [
      {
        name: 'message_id',
        description: 'The Message ID of the tracked milestone to stop updating',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];
const endpoints = new DiscordEndpoints(process.env.DISCORD_API_BASE);

async function registerCommands() {
  // If GUILD_ID is provided, register for that specific guild (updates instantly)
  // Otherwise, register globally
  const endpoint = GUILD_ID
    ? endpoints.guildCommands(APPLICATION_ID!, GUILD_ID)
    : endpoints.globalCommands(APPLICATION_ID!);

  const scopeLabel = GUILD_ID ? `guild (${GUILD_ID})` : 'global';
  console.log(`📡 Registering commands for ${scopeLabel}...`);

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(COMMANDS),
    });

    if (response.ok) {
      const data = (await response.json()) as Array<{ id: string; name: string }>;
      console.log(`✅ Successfully registered ${data.length} commands:`);
      for (const cmd of data) {
        console.log(`   - /${cmd.name} (ID: ${cmd.id})`);
      }
      if (!GUILD_ID) {
        console.log('ℹ️ Global commands may take up to a few minutes to propagate across Discord.');
      }
    } else {
      const errorText = await response.text();
      console.error(`❌ Registration failed (${response.status}):`, errorText);
    }
  } catch (err) {
    console.error('❌ Network error while registering commands:', err);
  }
}

registerCommands();
