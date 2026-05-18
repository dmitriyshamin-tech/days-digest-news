import { listRecentItems, deleteOldItems, type NewsItem } from "./storage.js";
import { sendMessage } from "./telegram.js";
import { NEWS_SOURCES } from "./sources.js";

const MAX_LEN = 4000;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("ru-RU", { timeZone: "Europe/Kiev", day: "2-digit", month: "2-digit", year: "numeric" });
}

function articleBlock(item: NewsItem): string {
  const date = item.publishedAt ? ` · ${fmtDate(item.publishedAt)}` : "";
  let b = `\n📌 <a href="${item.articleUrl}">${esc(item.title)}</a>\n`;
  b += `<i>${esc(item.sourceName)}${date}</i>\n`;
  if (item.summaryRu) b += `${esc(item.summaryRu)}\n`;
  for (const pt of item.keyPoints.slice(0, 3)) b += `• ${esc(pt)}\n`;
  return b;
}

function splitMessages(header: string, blocks: string[]): string[] {
  const msgs: string[] = [];
  let cur = header;
  for (const b of blocks) {
    if (cur.length + b.length > MAX_LEN) { msgs.push(cur.trimEnd()); cur = b; }
    else cur += b;
  }
  if (cur.trim()) msgs.push(cur.trimEnd());
  return msgs;
}

export async function sendReport(): Promise<void> {
  const items = listRecentItems(28);
  const date = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Kiev", day: "2-digit", month: "2-digit", year: "numeric" });

  if (items.length === 0) {
    await sendMessage(`<b>📰 Дайджест новостей — ${date}</b>\n\nМатериалов не найдено.`);
    return;
  }

  const order = new Map(NEWS_SOURCES.map((s, i) => [s.id, i]));
  const bySource = new Map<string, NewsItem[]>();
  for (const item of items) {
    const list = bySource.get(item.sourceId) ?? [];
    list.push(item);
    bySource.set(item.sourceId, list);
  }
  const sorted = Array.from(bySource.keys()).sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  const international = sorted.filter(id => NEWS_SOURCES.find(s => s.id === id)?.category === "international");
  const ukrainian = sorted.filter(id => NEWS_SOURCES.find(s => s.id === id)?.category === "ukrainian");

  const header = `<b>📰 Дайджест новостей — ${date}</b>\nСтатей: ${items.length}\n`;
  const blocks: string[] = [];

  function section(title: string, ids: string[]) {
    if (!ids.length) return;
    blocks.push(`\n<b>${title}</b>`);
    for (const id of ids) {
      const list = bySource.get(id) ?? [];
      if (!list.length) continue;
      blocks.push(`\n━━━ ${esc(list[0].sourceName)} ━━━`);
      for (const item of list) blocks.push(articleBlock(item));
    }
  }

  section("🌍 МЕЖДУНАРОДНЫЕ ИСТОЧНИКИ", international);
  section("🇺🇦 УКРАИНСКИЕ ИСТОЧНИКИ", ukrainian);

  for (const msg of splitMessages(header, blocks)) {
    await sendMessage(msg);
    await new Promise(r => setTimeout(r, 300));
  }

  const deleted = deleteOldItems();
  if (deleted > 0) console.log(`[report] Cleaned ${deleted} old items`);
}
