# 🤖 Telegram Userbot — Deleted Message Recovery

A Telegram userbot that logs all incoming direct messages (DMs) and recovers deleted messages by forwarding them to Saved Messages or a private log group.

## Features

- 📩 **Logs all incoming DMs** — caches message text, sender info, and media
- 🗑 **Recovers deleted messages** — intercepts deletions and forwards formatted copies
- 📎 **Media recovery** — downloads photos, videos, documents, voice messages, etc.
- 🧹 **Auto-cleanup** — TTL-based garbage collection prevents memory leaks (48h default)
- 🛡 **Error resilient** — won't crash on invalid media or missing keys

## Prerequisites

- Node.js ≥ 18
- Telegram API credentials from [my.telegram.org](https://my.telegram.org)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `API_ID` — from [my.telegram.org](https://my.telegram.org) → API Development Tools
- `API_HASH` — same page
- `LOG_CHAT_ID` — (optional) a group/channel ID to forward logs; leave empty for Saved Messages

### 3. Generate a session string

```bash
npm run session
```

Follow the prompts (phone number → verification code → 2FA if enabled). Copy the output `SESSION_STRING=...` line into your `.env`.

### 4. Start the bot

```bash
# Development (with ts-node)
npm run dev

# Production
npm run build
npm start
```

## How It Works

1. **Incoming DM** → The bot caches the message (text, sender, media) in memory
2. **Message deleted** → The bot detects the deletion, retrieves the cached data, formats it as HTML, and sends it to your log destination
3. **Media recovery** → If the deleted message had a photo/video/file, the bot re-attaches it

## Configuration

| Variable | Required | Description |
|---|---|---|
| `API_ID` | ✅ | Telegram API ID from my.telegram.org |
| `API_HASH` | ✅ | Telegram API Hash from my.telegram.org |
| `LOG_CHAT_ID` | ❌ | Chat ID for deleted message logs. Empty = Saved Messages |
| `SESSION_STRING` | ❌ | GramJS session string. Empty = interactive login |

## Project Structure

```
src/
├── index.ts        # Entry point — validates config, starts bot
├── auth.ts         # GramJS client authentication
├── cache.ts        # In-memory message cache with TTL cleanup
├── handlers.ts     # NewMessage + DeleteMessages event handlers
├── formatter.ts    # HTML formatting for deleted message alerts
└── media.ts        # Media download and re-send utilities
```

## Session Management

The session string keeps you logged in across restarts. Without it, you'll need to enter your phone number and verification code each time.

**To reset session:** Delete the `SESSION_STRING` line from `.env` and run `npm run session` again.

## Development

```bash
# Type-check without emitting
npm run typecheck

# Build TypeScript
npm run build
```

## Important Notes

- ⚠️ This is a **userbot** (user account), not a regular bot. It runs under your personal Telegram account.
- ⚠️ Session strings are sensitive — treat them like passwords. Never commit `.env` to git.
- ⚠️ The `telegram` (GramJS) package is archived. For future projects, consider [teleproto](https://npmjs.com/package/teleproto).
- The cache stores messages for 48 hours by default. Older messages are automatically purged.

## License

MIT
