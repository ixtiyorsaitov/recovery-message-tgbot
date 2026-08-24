/**
 * Formats deleted message metadata into a clean HTML string
 * compatible with Telegram Bot API (only supported tags).
 */

import { CachedMessage } from "./cache";

const MEDIA_EMOJI: Record<string, string> = {
  photo: "🖼",
  video: "🎬",
  document: "📄",
  voice: "🎤",
  audio: "🎵",
  sticker: "🩹",
  gif: "🎞",
  video_note: "📹",
};

/**
 * Build a clean, Bot API compatible HTML summary of a deleted message.
 */
export function formatDeletedMessage(message: CachedMessage): string {
  const sender = buildSenderLine(message);
  const date = formatDate(message.date);
  const content = buildContent(message);
  const mediaLine = message.mediaType
    ? `  ${MEDIA_EMOJI[message.mediaType] || "📎"} <i>${capitalize(message.mediaType)}</i>\n`
    : "";
  const msgId = message.senderId;

  return [
    `🗑 <b>Deleted message recovered!</b>`,
    ``,
    `<b>👤 Sender:</b>`,
    sender,
    ``,
    `<b>📅 Date:</b>`,
    `  ${date}`,
    ``,
    mediaLine ? `<b>📎 Media:</b>\n${mediaLine}` : ``,
    content
      ? `<b>💬 Message:</b>\n<pre>${content}</pre>`
      : `  <i>No text content</i>`,
    ``,
    `<span class="tg-spoiler">🆔 ID: ${msgId}</span>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build a short preview of a message for console logs.
 */
export function messagePreview(message: CachedMessage): string {
  const name = message.username
    ? `@${message.username}`
    : message.firstName || `User#${message.senderId}`;
  const text = (message.text || message.caption || "").slice(0, 60);
  const media = message.mediaType ? ` [${message.mediaType}]` : "";
  return `${name}: "${text}"${media}`;
}

// ── Helpers ────────────────────────────────────────────────

function buildSenderLine(m: CachedMessage): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Unknown";
  const username = m.username
    ? `\n  <a href="tg://user?id=${m.senderId}">@${escapeHtml(m.username)}</a>`
    : "";
  const idBadge = `\n  <code>${m.senderId}</code>`;
  return `  <b>${escapeHtml(name)}</b>${username}${idBadge}`;
}

function buildContent(m: CachedMessage): string {
  const raw = m.text || m.caption || "";
  if (!raw) return "";
  const truncated =
    raw.length > 4000 ? raw.slice(0, 4000) + "\n\n…(truncated)" : raw;
  return escapeHtml(truncated);
}

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
