/**
 * Telegram event handlers:
 *  - NewMessage: cache incoming DMs
 *  - DeletedMessage: recover and forward deleted messages
 */

import { TelegramClient } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { DeletedMessage, DeletedMessageEvent } from "telegram/events/DeletedMessage";
import { Api } from "telegram/tl";
import bigInt from "big-integer";
import { MessageCache } from "./cache";
import { formatDeletedMessage, messagePreview } from "./formatter";
import { detectMediaType } from "./media";
import { sendDeletedMessageAlert, isBotSentMessage, getBotUserId } from "./bot";

/**
 * Register all event handlers on the client.
 */
export async function registerHandlers(
  client: TelegramClient,
  cache: MessageCache,
  targetChatId: number | string
): Promise<void> {
  // Get own ID once to filter Saved Messages
  const me = await client.getMe();
  const myId = typeof me.id === "object" && "toJSNumber" in me.id
    ? (me.id as bigInt.BigInteger).toJSNumber()
    : Number(me.id);
  console.log(`🔑 Own user ID: ${myId} (for Saved Messages filtering)`);

  // ── NewMessage: cache incoming DMs ──────────────────────
  client.addEventHandler(
    async (event: NewMessageEvent) => {
      try {
        await handleNewMessage(client, cache, event, myId);
      } catch (err) {
        console.error("⚠️  Error in NewMessage handler:", err);
      }
    },
    new NewMessage({ incoming: true })
  );

  // ── DeletedMessage: recover deleted messages ────────────
  client.addEventHandler(
    async (event: DeletedMessageEvent) => {
      try {
        await handleDeletedMessages(client, cache, targetChatId, event);
      } catch (err) {
        console.error("⚠️  Error in DeletedMessage handler:", err);
      }
    },
    new DeletedMessage({})
  );

  console.log("👂 Event handlers registered (NewMessage + DeletedMessage)");
}

// ═══════════════════════════════════════════════════════════
//  NewMessage handler
// ═══════════════════════════════════════════════════════════

async function handleNewMessage(
  client: TelegramClient,
  cache: MessageCache,
  event: NewMessageEvent,
  myId: number
): Promise<void> {
  const msg = event.message;

  // Only handle private (DM) incoming messages
  if (!event.isPrivate || msg.out) return;

  const senderIdRaw = msg.senderId;
  if (!senderIdRaw) return;

  // senderId is BigInteger — convert to number
  const senderId = typeof senderIdRaw === "object" && "toJSNumber" in senderIdRaw
    ? (senderIdRaw as bigInt.BigInteger).toJSNumber()
    : Number(senderIdRaw);

  // Skip messages from the bot itself
  const botId = getBotUserId();
  if (botId && senderId === botId) return;

  // Fetch sender info — try message.getSender() first, then getEntity()
  let isBot = false;
  let username: string | undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;

  try {
    const sender = await msg.getSender();
    if (sender && "firstName" in sender) {
      const u = sender as Api.User;
      isBot = !!u.bot;
      username = u.username;
      firstName = u.firstName;
      lastName = u.lastName;
    }
  } catch {
    // Fallback: try getEntity
    try {
      const sender = await client.getEntity(senderId);
      if (sender instanceof Api.User) {
        isBot = !!sender.bot;
        username = sender.username;
        firstName = sender.firstName;
        lastName = sender.lastName;
      }
    } catch {
      // Both failed — cache without name
    }
  }

  // Skip messages from Telegram bots
  if (isBot) {
    console.log(`🤖 Skipped bot message from ${username || senderId}`);
    return;
  }

  // Skip Saved Messages (messages to yourself)
  if (senderId === myId) {
    console.log(`💾 Skipped Saved Messages`);
    return;
  }

  const mediaType = detectMediaType(msg);

  cache.set(msg.id, {
    senderId,
    username,
    firstName,
    lastName,
    text: msg.message || undefined,
    caption: msg.message || undefined,
    date: new Date(msg.date * 1000),
    mediaType,
  });

  console.log(`📩 Cached DM: ${messagePreview(cache.get(msg.id)!)}`);
}

// ═══════════════════════════════════════════════════════════
//  DeletedMessage handler
// ═══════════════════════════════════════════════════════════

async function handleDeletedMessages(
  client: TelegramClient,
  cache: MessageCache,
  targetChatId: number | string,
  event: DeletedMessageEvent
): Promise<void> {
  const deletedIds = event.deletedIds;
  if (!deletedIds || deletedIds.length === 0) return;

  for (const msgId of deletedIds) {
    // Skip messages sent by the bot itself
    if (isBotSentMessage(msgId)) {
      continue;
    }

    const cached = cache.get(msgId);
    if (!cached) continue;

    console.log(
      `🗑 Recovering deleted message ${msgId} from ${messagePreview(cached)}`
    );

    // Send alert via Bot API (bot → you)
    const sent = await sendDeletedMessageAlert(targetChatId, cached);

    if (sent) {
      console.log(`  ✅ Deleted message ${msgId} sent via bot`);
    } else {
      console.error(`  ⚠️  Failed to send deleted message ${msgId} via bot`);
    }

    // Remove from cache after recovery
    cache.delete(msgId);
  }
}
