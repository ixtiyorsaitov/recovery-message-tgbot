/**
 * Session string generator.
 * Run: npx ts-node session-gen.ts
 * This will log you in and output a SESSION_STRING for your .env file.
 */

import dotenv from "dotenv";
dotenv.config();

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const input: { text: (prompt: string) => Promise<string> } = require("input");

async function main(): Promise<void> {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH || "";

  if (!apiId || !apiHash) {
    console.error(
      "❌ API_ID and API_HASH must be set in .env before running this script.\n" +
        "   Get them from https://my.telegram.org"
    );
    process.exit(1);
  }

  console.log("🔑 Generating a new session string...\n");

  const client = new TelegramClient(new StringSession(), apiId, apiHash, {
    deviceModel: "Userbot Desktop",
    systemVersion: "Windows 10",
    appVersion: "1.0.0",
    langCode: "en",
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Phone number: "),
    password: async () => await input.text("2FA Password (blank if none): "),
    phoneCode: async () => await input.text("Verification code: "),
    onError: (err) => console.error("Auth error:", err),
  });

  const sessionStr = client.session.save() as unknown as string;

  console.log("\n✅ Login successful!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Add this line to your .env file:\n");
  console.log(`SESSION_STRING=${sessionStr}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await client.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
