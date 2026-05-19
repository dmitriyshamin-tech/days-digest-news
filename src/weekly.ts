import Anthropic from "@anthropic-ai/sdk";
import { listRecentItems } from "./storage.js";
import { sendMessage } from "./telegram.js";

const MAX_ITEMS_FOR_ANALYSIS = 60;

function kyivDateRange(): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Europe/Kiev", day: "2-digit", month: "2-digit", year: "numeric" };
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  return `${weekAgo.toLocaleDateString("ru-RU", opts)} — ${now.toLocaleDateString("ru-RU", opts)}`;
}

const WEEKLY_SYSTEM = `Ты senior-аналитик для e-commerce и мебельного бизнеса в Украине.
Пишешь еженедельную аналитическую статью для Facebook/LinkedIn на основе новостей недели.

СТРУКТУРА (строго, с Telegram HTML-тегами):
<b>🔥 ГЛАВНЫЙ ТРЕНД НЕДЕЛИ</b>
[2-3 предложения — самый важный тренд с цифрами]

<b>📊 КЛЮЧЕВЫЕ ЦИФРЫ НЕДЕЛИ</b>
• [число/факт 1]
• [число/факт 2]
• [число/факт 3]
• [число/факт 4]

<b>🗓 ТОП-5 СОБЫТИЙ</b>
<b>1.</b> [Заголовок события]
[1 предложение — суть + почему важно для бизнеса]

<b>2.</b> ...

<b>💡 ВЫВОД ДЛЯ БИЗНЕСА</b>
[2-3 предложения — что делать, на что обратить внимание]

<i>#ecommerce #маркетинг #AIтренды #Украина #ретейл #диджитал</i>

ПРАВИЛА:
- ТОЛЬКО факты из предоставленных материалов, не придумывай
- Цифры и проценты — только реальные из текстов статей
- Запрещены фразы: "стоит отметить", "важно учитывать", "статья будет полезна"
- Если цифр мало — фокус на качественных выводах
- Пиши на русском языке`;

export async function sendWeeklyArticle(): Promise<void> {
  console.log("[weekly] Generating weekly article...");
  const items = listRecentItems(168); // 7 days
  const dateRange = kyivDateRange();

  if (items.length < 3) {
    await sendMessage(`<b>📊 Дайджест недели — ${dateRange}</b>\n\nНедостаточно материалов (собрано: ${items.length}).`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("[weekly] No ANTHROPIC_API_KEY"); return; }

  // Compact summary for Claude
  const input = items.slice(0, MAX_ITEMS_FOR_ANALYSIS).map(item => ({
    source: item.sourceName,
    title: item.title,
    summary: item.summaryRu ?? "",
    keyPoints: item.keyPoints.slice(0, 2),
  }));

  try {
    const anthropic = new Anthropic({ apiKey });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20251001",
      max_tokens: 2500,
      system: WEEKLY_SYSTEM,
      messages: [{
        role: "user",
        content: `Период: ${dateRange}\nСтатей для анализа: ${items.length}\n\nМатериалы недели:\n${JSON.stringify(input, null, 2)}`,
      }],
    });

    const article = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
    if (!article) { console.error("[weekly] Empty response"); return; }

    const header = `<b>📊 ДАЙДЖЕСТ НЕДЕЛИ — ${dateRange}</b>\n(на основе ${items.length} материалов)\n\n`;
    const full = header + article;

    // Split if longer than 4000 chars
    if (full.length <= 4000) {
      await sendMessage(full);
    } else {
      await sendMessage(full.slice(0, 3900) + "\n\n<i>— продолжение →</i>");
      await new Promise(r => setTimeout(r, 500));
      await sendMessage(full.slice(3900));
    }

    console.log(`[weekly] Article sent (${items.length} items, ${full.length} chars)`);
  } catch (e: any) {
    console.error("[weekly] Error:", e?.message);
  }
}
