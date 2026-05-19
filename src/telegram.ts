export async function sendMessage(text: string): Promise<void> {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const CHAT = process.env.TG_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID ?? "";
  if (!TOKEN || !CHAT) { console.log("[telegram] Not configured, skipping"); return; }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) console.error(`[telegram] Error ${res.status}: ${await res.text()}`);
}
