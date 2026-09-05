/**
 * Telegram Userbot — Main entry point.
 * Connects to Telegram via GramJS, registers handlers,
 * and sends deleted message alerts via Bot API.
 */

import dotenv from "dotenv";
dotenv.config();

import { MessageCache } from "./cache";
import { createClient } from "./auth";
import { registerHandlers } from "./handlers";
import { initBot } from "./bot";
import { TelegramClient } from "telegram";

// ── Environment validation ────────────────────────────────

function validateEnv(): void {
  const apiId = process.env.API_ID;
  const apiHash = process.env.API_HASH;
  const botToken = process.env.BOT_TOKEN;

  if (!apiId || apiId === "your_api_id_here") {
    throw new Error(
      "❌ API_ID is not set. Please configure your .env file.\n" +
        "   Get API credentials from https://my.telegram.org"
    );
  }
  if (!apiHash || apiHash === "your_api_hash_here") {
    throw new Error(
      "❌ API_HASH is not set. Please configure your .env file.\n" +
        "   Get API credentials from https://my.telegram.org"
    );
  }
  if (!botToken || botToken === "your_bot_token_here") {
    throw new Error(
      "❌ BOT_TOKEN is not set. Please configure your .env file.\n" +
        "   Create a bot via @BotFather on Telegram and paste the token."
    );
  }
}

// ── Connect with retry ────────────────────────────────────

async function connectWithRetry(
  client: TelegramClient,
  maxRetries = 10
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔌 Connecting to Telegram (attempt ${attempt}/${maxRetries})...`);
      await client.connect();
      console.log("✅ Connected successfully!");
      return;
    } catch (err) {
      console.error(`❌ Connection attempt ${attempt} failed:`, (err as Error).message);
      if (attempt < maxRetries) {
        const delay = Math.min(attempt * 5000, 30000); // progressive backoff, max 30s
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error("❌ Could not connect to Telegram after all retries.");
}

// ── Main ──────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🤖 Telegram Userbot starting...\n");

  validateEnv();

  // Determine target chat for alerts
  const targetChatId = process.env.LOG_CHAT_ID
    ? process.env.LOG_CHAT_ID
    : process.env.BOT_OWNER_ID;

  if (!targetChatId) {
    throw new Error(
      "❌ Neither LOG_CHAT_ID nor BOT_OWNER_ID is set.\n" +
        "   Set LOG_CHAT_ID in .env (your chat ID or @username).\n" +
        "   Or set BOT_OWNER_ID (your Telegram user ID)."
    );
  }

  // Initialize Bot API with owner ID
  const botToken = process.env.BOT_TOKEN!;
  const bot = await initBot(botToken, targetChatId);

  // Start bot polling for /start commands
  bot.start({
    onStart: () => console.log("🤖 Bot polling started (listening for /start)"),
  });

  console.log(`📁 Sending alerts to: ${targetChatId}`);

  // Create message cache
  const cache = new MessageCache();

  // Authenticate with Telegram (GramJS)
  const client = await createClient();

  // Register event handlers (client already connected via createClient)
  await registerHandlers(client, cache, targetChatId);

  console.log(`\n🟢 Userbot is running! Cache size: ${cache.size}`);
  console.log("   Press Ctrl+C to stop.\n");

  // ── Handle disconnections ────────────────────────────────
  // GramJS fires this when connection drops
  client.addEventHandler(async () => {
    console.log("⚠️  Connection lost! Attempting reconnect...");
  });

  // ── Graceful shutdown ─────────────────────────────────
  const shutdown = async () => {
    console.log("\n🔴 Shutting down...");
    cache.stopCleanup();
    bot.stop();
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    console.log("👋 Goodbye!");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ── Run ───────────────────────────────────────────────────

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
