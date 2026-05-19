let _chatId: string = "";

async function resolveChatId(token: string): Promise<string> {
  // 1. Try clean env vars
  const fromEnv = process.env.TG_CHAT_ID ?? "";
  if (fromEnv) return fromEnv;

  // 2. Use cached discovered value
  if (_chatId) return _chatId;

  // 3. Auto-discover via getUpdates (reads the latest message sent to the bot)
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10&timeout=0`);
    const data = await res.json() as any;
    if (data.ok && data.result?.length > 0) {
      for (const upd of [...data.result].reverse()) {
        const id = upd.message?.chat?.id ?? upd.channel_post?.chat?.id;
        if (id) {
          _chatId = String(id);
          console.log(`[telegram] Auto-discovered chat_id: ${_chatId}`);
          return _chatId;
        }
      }
    }
  } catch (e: any) {
    console.error("[telegram] getUpdates failed:", e?.message);
  }

  // 4. Last resort: fall back to whatever TELEGRAM_CHAT_ID has
  return process.env.TELEGRAM_CHAT_ID ?? "";
}

export async function sendMessage(text: string): Promise<void> {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!TOKEN) { console.log("[telegram] No bot token, skipping"); return; }

  const CHAT = await resolveChatId(TOKEN);
  if (!CHAT) { console.log("[telegram] No chat_id found, skipping"); return; }

  console.log(`[telegram] Sending to chat_id: ${CHAT}`);
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) console.error(`[telegram] Error ${res.status}: ${await res.text()}`);
}
