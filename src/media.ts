/**
 * Media downloading and re-sending utilities.
 * When a deleted message contained media, we retrieve the cached file
 * and forward it alongside the text details.
 */

import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";
import path from "path";
import fs from "fs";
import { CachedMessage } from "./cache";

const MEDIA_DIR = path.resolve("media");

/** Ensure the media directory exists. */
function ensureMediaDir(): void {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

/**
 * Determine the media type string from a Message object.
 */
export function detectMediaType(
  message: Api.Message
): CachedMessage["mediaType"] {
  if (message.media instanceof Api.MessageMediaPhoto) return "photo";
  if (message.media instanceof Api.MessageMediaDocument) {
    const doc = message.media.document;
    if (doc instanceof Api.Document) {
      const mime = doc.mimeType || "";
      if (mime.startsWith("video/")) return "video";
      if (mime.startsWith("audio/")) return "audio";
      if (mime === "voice/ogg") return "voice";
      if (mime === "image/gif") return "gif";
      // Check attributes for stickers / video notes
      for (const attr of doc.attributes) {
        if (attr instanceof Api.DocumentAttributeVideo) {
          return attr.roundMessage ? "video_note" : "video";
        }
        if (attr instanceof Api.DocumentAttributeSticker) return "sticker";
      }
      return "document";
    }
  }
  return undefined;
}

/**
 * Download media from a message to the local media/ directory.
 * Returns the file path, or undefined if no media / download failed.
 */
export async function downloadMedia(
  client: TelegramClient,
  messageId: number,
  message: Api.Message
): Promise<string | undefined> {
  if (!message.media) return undefined;

  ensureMediaDir();

  try {
    const result = await client.downloadMedia(message, {
      outputFile: MEDIA_DIR,
    });

    if (result && typeof result === "string") {
      // GramJS returns the full file path as a string
      return result;
    }

    // If it returned a Buffer, save it manually
    if (Buffer.isBuffer(result)) {
      const ext = getExtension(message);
      const fileName = `${messageId}_${Date.now()}${ext}`;
      const filePath = path.join(MEDIA_DIR, fileName);
      fs.writeFileSync(filePath, result);
      return filePath;
    }

    return undefined;
  } catch (err) {
    console.error(
      `⚠️  Failed to download media for message ${messageId}:`,
      err
    );
    return undefined;
  }
}

/**
 * Send cached media along with a text message to the logging chat.
 * Returns true if media was sent successfully.
 */
export async function sendCachedMedia(
  client: TelegramClient,
  chatId: number | string,
  message: CachedMessage,
  captionHtml: string
): Promise<boolean> {
  if (!message.mediaPath || !fs.existsSync(message.mediaPath)) {
    return false;
  }

  try {
    await client.sendFile(chatId, {
      file: message.mediaPath,
      caption: captionHtml,
      parseMode: "html",
    });
    return true;
  } catch (err) {
    console.error(`⚠️  Failed to send cached media:`, err);
    return false;
  }
}

// ── Helpers ────────────────────────────────────────────────

function getExtension(message: Api.Message): string {
  if (message.media instanceof Api.MessageMediaPhoto) return ".jpg";
  if (message.media instanceof Api.MessageMediaDocument) {
    const doc = message.media.document;
    if (doc instanceof Api.Document) {
      for (const attr of doc.attributes) {
        if (attr instanceof Api.DocumentAttributeFilename) {
          const name = attr.fileName || "";
          const dot = name.lastIndexOf(".");
          if (dot !== -1) return name.slice(dot);
        }
      }
    }
  }
  return ".bin";
}
