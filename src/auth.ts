/**
 * Telegram client authentication using GramJS StringSession.
 * Handles login flow and session persistence.
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const input: { text: (prompt: string) => Promise<string> } = require("input");

const DEVICE_OPTIONS = {
  deviceModel: "Linux Server",
  systemVersion: "Ubuntu 22.04",
  appVersion: "1.0.0",
  langCode: "en",
};

/**
 * Create and authenticate a TelegramClient.
 * If SESSION_STRING is provided, reuses it; otherwise runs interactive login.
 */
export async function createClient(): Promise<TelegramClient> {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH || "";
  const sessionString = process.env.SESSION_STRING || "";

  if (!apiId || !apiHash) {
    throw new Error(
      "API_ID and API_HASH must be set in your .env file.\n" +
        "Get them from https://my.telegram.org"
    );
  }

  const session = sessionString
    ? new StringSession(sessionString)
    : new StringSession();

  const client = new TelegramClient(session, apiId, apiHash, {
    ...DEVICE_OPTIONS,
    connectionRetries: 15,
    retryDelay: 5000,
    autoReconnect: true,
    useIPV6: false,
    timeout: 120000,
    requestRetries: 10,
    downloadRetries: 3,
    useWSS: false,
    testServers: false,
  });

  console.log("🔑 Authenticating with Telegram...");

  await client.start({
    phoneNumber: async () => await input.text("Phone number: "),
    password: async () => await input.text("2FA Password (blank if none): "),
    phoneCode: async () => await input.text("Verification code: "),
    onError: (err) => console.error("❌ Auth error:", err),
  });

  const me = await client.getMe();
  console.log(`✅ Logged in as: ${me.firstName} (@${me.username || "N/A"}) [ID: ${me.id}]`);

  // Print session string so user can save it
  const newSession = client.session.save() as unknown as string;
  if (!sessionString) {
    console.log("\n⚠️  Save this SESSION_STRING in your .env to avoid re-login:\n");
    console.log(`SESSION_STRING=${newSession}\n`);
  }

  return client;
}
