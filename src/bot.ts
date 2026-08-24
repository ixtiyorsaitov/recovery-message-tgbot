/**
 * Telegram Bot API wrapper using grammy.
 * Sends deleted message logs and new user alerts via the user's personal bot.
 */

import { Bot } from "grammy";
import { CachedMessage } from "./cache";
import { formatDeletedMessage } from "./formatter";

let bot: Bot | null = null;
let ownerId: number | string | null = null;
let botUserId: number | null = null;

// Track message IDs sent by the bot — ignore their deletions
const botSentMessageIds: Set<number> = new Set();

/**
 * Initialize the bot with the given token.
 */
export async function initBot(
  token: string,
  ownerChatId: number | string
): Promise<Bot> {
  bot = new Bot(token);
  ownerId = ownerChatId;

  // Get bot's own user ID to filter its messages
  try {
    const me = await bot.api.getMe();
    botUserId = me.id;
    console.log(`🤖 Bot ID: ${me.id} (@${me.username})`);
  } catch {
    console.warn("⚠️  Could not fetch bot info");
  }

  // Register /start command handler
  bot.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user || !ownerId) return;

    // Skip if the owner starts the bot
    if (String(user.id) === String(ownerId)) {
      await ctx.reply("✅ Bot tayyor! Xabarlarni tinglayapman...");
      return;
    }

    // Build user info
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
    const username = user.username ? `@${user.username}` : "yo'q";
    const language = user.language_code || "noma'lum";

    const alert = [
      `🆕 <b>Yangi foydalanuvchi botni boshladi!</b>`,
      ``,
      `<b>👤 Ism:</b> ${escapeHtml(name)}`,
      `<b>🆔 ID:</b> <code>${user.id}</code>`,
      `<b>📌 Username:</b> ${username}`,
      `<b>🌐 Til:</b> ${language}`,
      ``,
      `<a href="tg://user?id=${user.id}">Profilga o'tish</a>`,
    ].join("\n");

    try {
      await bot!.api.sendMessage(ownerId, alert, { parse_mode: "HTML" });
    } catch (err) {
      console.error("⚠️  Failed to send new user alert:", err);
    }

    // Reply to the user
    await ctx.reply(
      "😂"
    );
  });

  console.log(`🤖 Bot initialized with token: ${token.slice(0, 8)}...`);
  return bot;
}

/**
 * Get the bot's own user ID.
 */
export function getBotUserId(): number | null {
  return botUserId;
}

/**
 * Check if a message was sent by the bot itself.
 */
export function isBotSentMessage(msgId: number): boolean {
  return botSentMessageIds.has(msgId);
}

/**
 * Send a deleted message alert to the target chat via Bot API.
 */
export async function sendDeletedMessageAlert(
  chatId: number | string,
  message: CachedMessage
): Promise<boolean> {
  if (!bot) {
    console.error("⚠️  Bot not initialized. Call initBot() first.");
    return false;
  }

  const text = formatDeletedMessage(message);

  try {
    const result = await bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
    });
    if (result && result.message_id) {
      botSentMessageIds.add(result.message_id);
    }
    return true;
  } catch (err) {
    console.error(`⚠️  Bot failed to send message:`, err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
