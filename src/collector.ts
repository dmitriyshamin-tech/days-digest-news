import Anthropic from "@anthropic-ai/sdk";
import { insertNewsItem, urlExists } from "./storage.js";
import { NEWS_SOURCES, type NewsSource } from "./sources.js";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}
const LOOKBACK_HOURS = 48;
const MAX_PER_SOURCE = 12;
const BATCH_SIZE = 6;

interface RawArticle {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  articleUrl: string;
  title: string;
  description: string;
  publishedAt: number | null;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function cdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function parseDate(s: string): number {
  const ts = Date.parse(s);
  return isNaN(ts) ? Math.floor(Date.now() / 1000) : Math.floor(ts / 1000);
}

function parseRSS(xml: string, src: NewsSource): RawArticle[] {
  const results: RawArticle[] = [];
  const re = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  for (const m of xml.matchAll(re)) {
    const body = m[1];
    const titleRaw = body.match(/<title[^>]*>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/title>/)?.[2] ?? "";
    const title = stripTags(cdata(titleRaw));
    if (!title) continue;

    const linkRss = body.match(/<link[^>]*>(https?:\/\/[^\s<]+?)<\/link>/)?.[1];
    const linkAtom = body.match(/<link[^>]+href="([^"]+)"/)?.[1];
    const articleUrl = linkRss ?? linkAtom ?? "";
    if (!articleUrl.startsWith("http")) continue;

    const descRaw = body.match(/<(?:description|summary)[^>]*>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/(?:description|summary)>/)?.[2] ?? "";
    const description = stripTags(cdata(descRaw)).slice(0, 400);

    const pubRaw = body.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/)?.[1]?.trim() ?? "";
    // Use null when date is missing — avoids fake "current time" that bypasses cutoff filter
    const publishedAt = pubRaw ? parseDate(pubRaw) : null;

    results.push({ sourceId: src.id, sourceName: src.name, sourceUrl: src.baseUrl, articleUrl, title, description, publishedAt });
  }
  return results;
}

function parseHTML(html: string, src: NewsSource): RawArticle[] {
  const results: RawArticle[] = [];
  const origin = new URL(src.baseUrl).origin;
  const re = /<h[23][^>]*>[\s\S]*?<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    let url = m[1];
    const title = stripTags(m[2]);
    if (!title || title.length < 15) continue;
    if (url.startsWith("/")) url = `${origin}${url}`;
    if (!url.startsWith("http")) continue;
    results.push({ sourceId: src.id, sourceName: src.name, sourceUrl: src.baseUrl, articleUrl: url, title, description: "", publishedAt: Math.floor(Date.now() / 1000) });
  }
  return results;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; DaysDigestBot/1.0)", accept: "text/html,application/rss+xml,*/*" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function getArticles(src: NewsSource): Promise<RawArticle[]> {
  const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;
  let articles: RawArticle[] = [];

  if (src.rssUrl) {
    try {
      articles = parseRSS(await fetchText(src.rssUrl), src);
    } catch { /* fall through */ }
  }
  if (articles.length === 0) {
    try {
      articles = parseHTML(await fetchText(src.baseUrl), src);
    } catch (e: any) {
      console.warn(`[collector] ${src.name}: ${e?.message}`);
      return [];
    }
  }

  const seen = new Set<string>();
  const filtered: RawArticle[] = [];
  for (const a of articles) {
    // Skip only if date is known AND too old. null = unknown date, treat as recent.
    if (a.publishedAt !== null && a.publishedAt < cutoff) continue;
    if (seen.has(a.articleUrl)) continue;
    if (await urlExists(a.articleUrl)) continue;
    seen.add(a.articleUrl);
    filtered.push(a);
    if (filtered.length >= MAX_PER_SOURCE) break;
  }
  return filtered;
}

// ── Claude summarization ──────────────────────────────────────────────────────

const KEYWORDS = [
  // e-commerce & retail
  "e-commerce","ecommerce","retail","online store","shopify","amazon","marketplace","conversion","checkout",
  "cart abandonment","product page","customer experience","omnichannel","fulfillment","supply chain",
  // AI & tech
  "ai","artificial intelligence","machine learning","generative ai","llm","automation","chatbot",
  "ai overview","aeo","answer engine","ai mode","ai search","personalization",
  // marketing & SEO
  "marketing","digital marketing","seo","search engine","local seo","brand visibility","social proof",
  "email marketing","content marketing","influencer","paid ads","ppc","cro","a/b test",
  // furniture & home
  "furniture","мебель","mattress","sleep","bedroom","home furnishing","interior","sofa","home decor",
  "furniture retailer","furniture store","furniture market","wellness","bedding",
  // finance & consumers
  "finance","market","consumer","purchasing","spending","inflation","gdp","e-commerce market",
  "buyer behavior","customer retention","loyalty","lifetime value",
  // Ukraine
  "ukraine","ukrainian","україна","є-комерція","маркетинг","технолог","споживач","rozetka","prom.ua",
];

function isRelevant(a: RawArticle): boolean {
  const text = `${a.title} ${a.description}`.toLowerCase();
  return KEYWORDS.some(k => text.includes(k));
}

// ── Topic deduplication ───────────────────────────────────────────────────────

// Stop-words and year tokens excluded from similarity comparison
const STOP = new Set(["that","this","with","from","have","will","been","were","they","their",
  "what","when","your","about","more","into","than","which","there","after","before",
  "2024","2025","2026","2027","how","why","what","best","top","new","using","use"]);

function significantWords(title: string): string[] {
  return title.toLowerCase()
    .split(/[\s\W]+/)
    .filter(w => w.length >= 5 && !STOP.has(w));
}

function isSimilarTitle(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = new Set(significantWords(b));
  if (wa.length < 2 || wb.size < 2) return false; // too short to compare
  const shared = wa.filter(w => wb.has(w)).length;
  // Require 4+ matching meaningful words — much stricter than before
  return shared >= 4;
}

async function deduplicateByTopic(articles: RawArticle[]): Promise<RawArticle[]> {
  const recent = await listRecentItems(48); // only last 2 days
  const recentTitles = recent.map(i => i.title);

  const kept: RawArticle[] = [];
  const keptTitles: string[] = [];
  let skipped = 0;

  for (const a of articles) {
    const isDupOfRecent = recentTitles.some(t => isSimilarTitle(a.title, t));
    const isDupOfKept   = keptTitles.some(t => isSimilarTitle(a.title, t));
    if (!isDupOfRecent && !isDupOfKept) {
      kept.push(a);
      keptTitles.push(a.title);
    } else {
      skipped++;
    }
  }
  if (skipped > 0) console.log(`[collector] Topic dedup: skipped ${skipped} near-duplicates`);
  return kept;
}

const SYSTEM = `Ты senior-аналитик для e-commerce и мебельного бизнеса в Украине. Пишешь для занятого руководителя.

ПРАВИЛА (строго):
- ЗАПРЕЩЕНО: "статья будет полезна", "важно отметить", "следует учитывать", "рекомендуется", любые вводные фразы
- ТОЛЬКО факты: цифры, проценты, названия компаний, даты, конкретные выводы
- Если цифр нет в тексте — не придумывай, пиши суть без них
- summaryRu = 1-2 предложения: главный факт + почему это важно для бизнеса. Без воды.
- keyPoints[0] = ТОП-вывод: самое важное из статьи одной фразой (с цифрой если есть)
- keyPoints[1-2] = конкретные данные, факты, действия из материала

Темы: e-commerce, AI, маркетинг, потребители, финансы, сон/велнес, украинский рынок.

Верни ТОЛЬКО валидный JSON-массив:
[{"articleUrl":"...","isRelevant":true,"summaryRu":"Конкретный факт. Почему важно.","keyPoints":["ТОП: главный вывод с цифрой","Факт/данные 2","Факт/данные 3"],"topicTags":["e-commerce"]}]
Если нерелевантна: isRelevant:false, остальные поля пустые.`;

async function summarize(articles: RawArticle[]): Promise<void> {
  const input = articles.map(a => ({ articleUrl: a.articleUrl, title: a.title, description: a.description.slice(0, 300) }));
  const resp = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: "user", content: `Проанализируй:\n${JSON.stringify(input, null, 2)}` }],
  });
  const raw = resp.content[0].type === "text" ? resp.content[0].text : "[]";
  // Extract JSON array robustly — Claude sometimes adds text before/after
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) { console.warn("[collector] No JSON array in Claude response"); return; }
  const results = JSON.parse(match[0]) as Array<{ articleUrl: string; isRelevant: boolean; summaryRu: string; keyPoints: string[]; topicTags: string[] }>;

  for (const r of results) {
    if (!r.isRelevant) continue;
    const src = articles.find(a => a.articleUrl === r.articleUrl);
    if (!src) continue;
    await insertNewsItem({ ...src, summaryRu: r.summaryRu, keyPoints: r.keyPoints, topicTags: r.topicTags });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runCollection(): Promise<{ fetched: number; stored: number; errors: number }> {
  console.log("[collector] Starting...");
  let fetched = 0; let errors = 0;
  const allNew: RawArticle[] = [];

  for (const src of NEWS_SOURCES) {
    await new Promise(r => setTimeout(r, 700));
    try {
      const articles = await getArticles(src);
      console.log(`[collector] ${src.name}: ${articles.length} new`);
      allNew.push(...articles);
      fetched += articles.length;
    } catch (e: any) {
      console.error(`[collector] ${src.name} error: ${e?.message}`);
      errors++;
    }
  }

  console.log(`[collector] Pipeline: fetched=${fetched} total from ${NEWS_SOURCES.length} sources`);

  // Filter by keywords
  const relevant = allNew.filter(isRelevant);
  console.log(`[collector] Pipeline: keyword filter ${allNew.length} → ${relevant.length} relevant`);
  if (relevant.length === 0) {
    console.warn("[collector] ⚠ 0 articles passed keyword filter — check KEYWORDS or RSS feeds");
  }

  // Remove topic duplicates
  const toSummarize = await deduplicateByTopic(relevant);
  console.log(`[collector] Pipeline: dedup ${relevant.length} → ${toSummarize.length} unique topics`);
  if (relevant.length > 0 && toSummarize.length === 0) {
    console.warn("[collector] ⚠ Dedup removed ALL articles — threshold may be too strict!");
  }

  let stored = 0;

  if (toSummarize.length === 0) {
    console.log("[collector] Nothing to summarize, skipping Claude API");
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[collector] ⚠ ANTHROPIC_API_KEY not set — skipping summarization");
  } else {
    for (let i = 0; i < toSummarize.length; i += BATCH_SIZE) {
      const batch = toSummarize.slice(i, i + BATCH_SIZE);
      try {
        await summarize(batch);
        stored += batch.length;
        console.log(`[collector] Summarized batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} articles`);
        await new Promise(r => setTimeout(r, 500));
      } catch (e: any) {
        console.error(`[collector] Claude error on batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e?.message}`);
        errors++;
      }
    }
  }

  console.log(`[collector] ✅ Done — fetched:${fetched} relevant:${relevant.length} unique:${toSummarize.length} stored:${stored} errors:${errors}`);
  return { fetched, stored, errors };
}
