// Load .env only in local development — Railway injects vars natively
if (process.env.NODE_ENV !== "production") {
  const { config } = await import("dotenv");
  config();
}
import { createServer } from "http";
import { startScheduler } from "./scheduler.js";
import { runCollection } from "./collector.js";
import { sendReport } from "./report.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><head><meta charset="utf-8"><title>Days Digest News</title>
      <style>body{font-family:sans-serif;max-width:500px;margin:60px auto;text-align:center}
      a{display:block;margin:16px auto;padding:14px 24px;background:#6c3fc5;color:#fff;border-radius:8px;text-decoration:none;font-size:16px}
      a:hover{background:#5a33a8}h1{color:#333}</style></head>
      <body>
        <h1>🤖 Days Digest News</h1>
        <p>Бот активен. Расписание: сбор в 04:00 и 06:00, отчёт в 07:00 (Киев)</p>
        <a href="/collect">▶ Запустить сбор новостей сейчас</a>
        <a href="/report">📨 Отправить дайджест в Telegram</a>
        <a href="/status">📊 Статус</a>
      </body></html>
    `);
    return;
  }

  if (url === "/collect") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<html><body><p>⏳ Сбор запущен... Проверьте логи Railway через 2-3 минуты.</p><a href="/">← Назад</a></body></html>`);
    runCollection().then(r => console.log("[http] collect done:", r)).catch(e => console.error("[http] collect error:", e));
    return;
  }

  if (url === "/report") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<html><body><p>📨 Дайджест отправлен в Telegram!</p><a href="/">← Назад</a></body></html>`);
    sendReport().then(() => console.log("[http] report sent")).catch(e => console.error("[http] report error:", e));
    return;
  }

  if (url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "running",
      kyivTime: new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kiev" }),
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🤖 Days Digest News bot started`);
  console.log(`   Kyiv time: ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kiev" })}`);
  console.log(`   Web UI: http://localhost:${PORT}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "✅ SET (" + process.env.ANTHROPIC_API_KEY.slice(0,10) + "...)" : "❌ NOT SET"}`);
  console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? "✅ SET (" + process.env.TELEGRAM_BOT_TOKEN.slice(0,10) + "...)" : "❌ NOT SET"}`);
  console.log(`   TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? "✅ SET (" + process.env.TELEGRAM_CHAT_ID + ")" : "❌ NOT SET"}`);
  console.log(`   TG_CHAT_ID: ${process.env.TG_CHAT_ID ? "✅ SET (" + process.env.TG_CHAT_ID + ")" : "❌ NOT SET"}`);
  startScheduler();
});
