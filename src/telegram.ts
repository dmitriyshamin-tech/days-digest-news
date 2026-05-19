let _chatId: string = "";

async function resolveChatId(token: string): Promise<string> {
  if (_chatId) return _chatId;

  // Always try getUpdates first — Railway env vars are unreliable
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=20&timeout=0`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json() as any;
    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (const upd of [...data.result].reverse()) {
        const id = upd.message?.chat?.id
          ?? upd.edited_message?.chat?.id
          ?? upd.channel_post?.chat?.id;
        if (id) {
          _chatId = String(id);
          console.log(`[telegram] chat_id from getUpdates: ${_chatId}`);
          return _chatId;
        }
      }
    } else {
      console.log(`[telegram] getUpdates empty or failed:`, JSON.stringify(data).slice(0, 200));
    }
  } catch (e: any) {
    console.error("[telegram] getUpdates error:", e?.message);
  }

  // Fallback to env vars
  const fromEnv = process.env.TG_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID ?? "";
  if (fromEnv) console.log(`[telegram] chat_id from env: ${fromEnv}`);
  return fromEnv;
}

export async function sendMessage(text: string): Promise<void> {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!TOKEN) { console.log("[telegram] No bot token"); return; }

  const CHAT = await resolveChatId(TOKEN);
  if (!CHAT) { console.log("[telegram] No chat_id found"); return; }

  console.log(`[telegram] Sending to ${CHAT} ...`);
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[telegram] Error ${res.status}: ${err}`);
    // If chat_id is wrong, reset cache so next call retries getUpdates
    if (res.status === 400 && err.includes("chat not found")) {
      _chatId = "";
    }
  }
}
