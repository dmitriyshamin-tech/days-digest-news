import Anthropic from "@anthropic-ai/sdk";
import { listRecentItems, type NewsItem } from "./storage.js";
import { sendMessage } from "./telegram.js";

const MAX_ITEMS = 70;

function kyivDateRange(): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Europe/Kiev", day: "2-digit", month: "2-digit", year: "numeric" };
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  return `${weekAgo.toLocaleDateString("ru-RU", opts)} — ${now.toLocaleDateString("ru-RU", opts)}`;
}

function groupByCategory(items: NewsItem[]) {
  const intl = items.filter(i => ["distillery","salsify","gwi","yahoo","minders","arxiv","mit","venturebeat","reuters"].includes(i.sourceId));
  const ua = items.filter(i => ["cases","listex","uam","marketer","retailers","forbes_ua"].includes(i.sourceId));
  return { intl, ua };
}

const WEEKLY_SYSTEM = `Ты — стратегический аналитик рынка e-commerce, retail и digital для украинского бизнеса.

Твоя задача: написать глубокую аналитическую статью, которая:
1. Анализирует причинно-следственные связи между мировыми трендами и украинским рынком
2. Использует модель "США/Европа — это будущее Украины через 1-3 года"
3. Находит аналогии: то, что произошло в США/Европе → что из этого уже есть в Украине → что придёт следующим
4. Оценивает покупательскую способность и состояние потребительского рынка
5. Делает конкретные прогнозы с обоснованием

СТРУКТУРА СТАТЬИ (используй Telegram HTML: <b>, <i>, •):

<b>🧭 ГЛАВНЫЙ ИНСАЙТ НЕДЕЛИ</b>
[Одна ёмкая фраза — самое важное открытие этой недели для украинского рынка]

<b>🌍 ЧТО ПРОИСХОДИТ В МИРЕ</b>
[2-3 абзаца. Ключевые тренды из США/Европы с цифрами. Фокус: e-commerce, AI, retail, потребительское поведение, финансы]

<b>🔗 ПРИЧИНА → СЛЕДСТВИЕ → УКРАИНА</b>
Разбери 2-3 конкретные цепочки по шаблону:
• <b>[Событие/тренд в США или Европе]</b> → [Что произошло дальше там] → <i>Для Украины: [прогноз или уже происходящее]</i>

<b>🇺🇦 УКРАИНСКИЙ РЫНОК СЕЙЧАС</b>
[Анализ украинских новостей: покупательская способность, поведение потребителей, что меняется. Цифры если есть]

<b>🔮 ПРОГНОЗ НА 3-12 МЕСЯЦЕВ</b>
[3-4 конкретных прогноза для украинского e-commerce и retail. Обосновывай аналогиями из мирового опыта]

<b>⚡ ЧТО ДЕЛАТЬ ПРЯМО СЕЙЧАС</b>
[2-3 конкретных действия для бизнеса — не общие слова, а конкретные шаги]

<i>#ecommerce #Украина #retail #маркетинг #тренды #прогноз #AIбизнес</i>

ЖЁСТКИЕ ПРАВИЛА:
— Только факты из предоставленных материалов. Не придумывай данные.
— Цифры — только из текстов. Если цифр нет — качественный анализ без чисел.
— Запрещено: "стоит отметить", "важно учитывать", "следует обратить внимание", "статья полезна"
— Каждый абзац должен нести конкретную информацию или вывод
— Связывай международные и украинские материалы в единую картину
— Пиши на русском языке, стиль: аналитик-практик, не журналист`;

async function splitAndSend(text: string): Promise<void> {
  const LIMIT = 3900;
  if (text.length <= LIMIT) {
    await sendMessage(text);
    return;
  }
  // Split at paragraph boundary near limit
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > LIMIT) {
    const chunk = remaining.slice(0, LIMIT);
    const lastNewline = chunk.lastIndexOf("\n\n");
    const cutAt = lastNewline > 2000 ? lastNewline : LIMIT;
    parts.push(remaining.slice(0, cutAt).trimEnd() + "\n\n<i>↓ продолжение</i>");
    remaining = remaining.slice(cutAt).trimStart();
  }
  parts.push(remaining);
  for (const part of parts) {
    await sendMessage(part);
    await new Promise(r => setTimeout(r, 600));
  }
}

export async function sendWeeklyArticle(): Promise<void> {
  console.log("[weekly] Starting strategic analysis...");
  const items = await listRecentItems(168); // 7 days
  const dateRange = kyivDateRange();

  if (items.length < 5) {
    await sendMessage(`<b>🧭 Аналитика недели — ${dateRange}</b>\n\nНедостаточно материалов для анализа (собрано: ${items.length}).`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("[weekly] No ANTHROPIC_API_KEY"); return; }

  const { intl, ua } = groupByCategory(items);

  // Build structured input separating international and Ukrainian sources
  const intlInput = intl.slice(0, 40).map(i => ({
    geo: "INTERNATIONAL",
    source: i.sourceName,
    title: i.title,
    summary: i.summaryRu ?? "",
    points: i.keyPoints.slice(0, 2),
  }));

  const uaInput = ua.slice(0, 30).map(i => ({
    geo: "UKRAINE",
    source: i.sourceName,
    title: i.title,
    summary: i.summaryRu ?? "",
    points: i.keyPoints.slice(0, 2),
  }));

  const allInput = [...intlInput, ...uaInput];

  console.log(`[weekly] Analyzing: ${intl.length} international + ${ua.length} Ukrainian items`);

  try {
    const anthropic = new Anthropic({ apiKey });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20251001",
      max_tokens: 4000,
      system: WEEKLY_SYSTEM,
      messages: [{
        role: "user",
        content: `Период анализа: ${dateRange}
Материалов для анализа: ${items.length} (международных: ${intl.length}, украинских: ${ua.length})

МАТЕРИАЛЫ НЕДЕЛИ:
${JSON.stringify(allInput, null, 2)}`,
      }],
    });

    const article = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
    if (!article) { console.error("[weekly] Empty response from Claude"); return; }

    const header = `<b>🧭 СТРАТЕГИЧЕСКИЙ АНАЛИЗ НЕДЕЛИ</b>\n<i>${dateRange} · ${items.length} источников</i>\n\n`;
    await splitAndSend(header + article);

    console.log(`[weekly] Done — ${items.length} items → ${article.length} chars`);
  } catch (e: any) {
    console.error("[weekly] Error:", e?.message);
  }
}
