import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const DB_PATH = process.env.DATABASE_PATH ?? "news.db";
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    article_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    published_at INTEGER,
    summary_ru TEXT,
    key_points TEXT,
    topic_tags TEXT,
    collected_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_article_url ON news_items(article_url);
`);

export interface NewsItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  articleUrl: string;
  title: string;
  description: string | null;
  publishedAt: number | null;
  summaryRu: string | null;
  keyPoints: string[];
  topicTags: string[];
  collectedAt: number;
}

export interface InsertNewsItem {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  articleUrl: string;
  title: string;
  description?: string | null;
  publishedAt?: number | null;
  summaryRu?: string | null;
  keyPoints?: string[];
  topicTags?: string[];
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO news_items
    (id, source_id, source_name, source_url, article_url, title, description,
     published_at, summary_ru, key_points, topic_tags, collected_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export function insertNewsItem(item: InsertNewsItem): boolean {
  const info = insertStmt.run(
    `news_${randomUUID().slice(0, 10)}`,
    item.sourceId, item.sourceName, item.sourceUrl, item.articleUrl,
    item.title, item.description ?? null, item.publishedAt ?? null,
    item.summaryRu ?? null,
    JSON.stringify(item.keyPoints ?? []),
    JSON.stringify(item.topicTags ?? []),
    Math.floor(Date.now() / 1000),
  );
  return info.changes > 0;
}

export function urlExists(articleUrl: string): boolean {
  const row = db.prepare("SELECT 1 FROM news_items WHERE article_url = ?").get(articleUrl);
  return row != null;
}

function toItem(row: any): NewsItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    articleUrl: row.article_url,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    summaryRu: row.summary_ru,
    keyPoints: row.key_points ? JSON.parse(row.key_points) : [],
    topicTags: row.topic_tags ? JSON.parse(row.topic_tags) : [],
    collectedAt: row.collected_at,
  };
}

export function listRecentItems(sinceHours = 28): NewsItem[] {
  const since = Math.floor(Date.now() / 1000) - sinceHours * 3600;
  const rows = db.prepare(
    "SELECT * FROM news_items WHERE collected_at >= ? AND summary_ru IS NOT NULL ORDER BY published_at DESC"
  ).all(since) as any[];
  return rows.map(toItem);
}

export function deleteOldItems(): number {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const info = db.prepare("DELETE FROM news_items WHERE collected_at < ?").run(weekAgo);
  return info.changes;
}
