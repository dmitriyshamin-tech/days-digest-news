import { randomUUID } from "crypto";

// ── Database backend (PostgreSQL on Railway, SQLite locally) ──────────────────

type DB = {
  init(): Promise<void>;
  insert(params: InsertParams): Promise<boolean>;
  urlExists(url: string): Promise<boolean>;
  listRecent(sinceHours: number): Promise<RawRow[]>;
  deleteOld(): Promise<number>;
};

interface InsertParams {
  id: string; sourceId: string; sourceName: string; sourceUrl: string;
  articleUrl: string; title: string; description: string | null;
  publishedAt: number | null; summaryRu: string | null;
  keyPoints: string; topicTags: string; collectedAt: number;
}

interface RawRow {
  id: string; source_id: string; source_name: string; source_url: string;
  article_url: string; title: string; description: string | null;
  published_at: number | null; summary_ru: string | null;
  key_points: string | null; topic_tags: string | null; collected_at: number;
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

async function makePgDB(): Promise<DB> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS news_items (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL, source_name TEXT NOT NULL,
          source_url TEXT NOT NULL, article_url TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL, description TEXT,
          published_at BIGINT, summary_ru TEXT,
          key_points TEXT, topic_tags TEXT, collected_at BIGINT NOT NULL
        )`);
    },
    async insert(p) {
      const res = await pool.query(
        `INSERT INTO news_items
           (id,source_id,source_name,source_url,article_url,title,description,
            published_at,summary_ru,key_points,topic_tags,collected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (article_url) DO NOTHING`,
        [p.id,p.sourceId,p.sourceName,p.sourceUrl,p.articleUrl,p.title,
         p.description,p.publishedAt,p.summaryRu,p.keyPoints,p.topicTags,p.collectedAt]
      );
      return (res.rowCount ?? 0) > 0;
    },
    async urlExists(url) {
      const r = await pool.query("SELECT 1 FROM news_items WHERE article_url=$1", [url]);
      return r.rowCount! > 0;
    },
    async listRecent(sinceHours) {
      const since = Math.floor(Date.now() / 1000) - sinceHours * 3600;
      const r = await pool.query(
        "SELECT * FROM news_items WHERE collected_at>=$1 AND summary_ru IS NOT NULL ORDER BY published_at DESC",
        [since]
      );
      return r.rows as RawRow[];
    },
    async deleteOld() {
      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
      const r = await pool.query("DELETE FROM news_items WHERE collected_at<$1", [weekAgo]);
      return r.rowCount ?? 0;
    },
  };
}

// ── SQLite (local dev fallback) ───────────────────────────────────────────────

async function makeSqliteDB(): Promise<DB> {
  const { default: Database } = await import("better-sqlite3");
  const path = process.env.DATABASE_PATH ?? "news.db";
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  return {
    async init() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS news_items (
          id TEXT PRIMARY KEY, source_id TEXT NOT NULL, source_name TEXT NOT NULL,
          source_url TEXT NOT NULL, article_url TEXT NOT NULL,
          title TEXT NOT NULL, description TEXT, published_at INTEGER,
          summary_ru TEXT, key_points TEXT, topic_tags TEXT, collected_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_article_url ON news_items(article_url);`);
    },
    async insert(p) {
      const info = db.prepare(
        `INSERT OR IGNORE INTO news_items
           (id,source_id,source_name,source_url,article_url,title,description,
            published_at,summary_ru,key_points,topic_tags,collected_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(p.id,p.sourceId,p.sourceName,p.sourceUrl,p.articleUrl,p.title,
            p.description,p.publishedAt,p.summaryRu,p.keyPoints,p.topicTags,p.collectedAt);
      return info.changes > 0;
    },
    async urlExists(url) {
      return db.prepare("SELECT 1 FROM news_items WHERE article_url=?").get(url) != null;
    },
    async listRecent(sinceHours) {
      const since = Math.floor(Date.now() / 1000) - sinceHours * 3600;
      return db.prepare(
        "SELECT * FROM news_items WHERE collected_at>=? AND summary_ru IS NOT NULL ORDER BY published_at DESC"
      ).all(since) as RawRow[];
    },
    async deleteOld() {
      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
      return (db.prepare("DELETE FROM news_items WHERE collected_at<?").run(weekAgo)).changes;
    },
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _db: DB | null = null;

async function getDB(): Promise<DB> {
  if (_db) return _db;
  _db = process.env.DATABASE_URL ? await makePgDB() : await makeSqliteDB();
  await _db.init();
  console.log(`[storage] Using ${process.env.DATABASE_URL ? "PostgreSQL" : "SQLite"}`);
  return _db;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string; sourceId: string; sourceName: string; sourceUrl: string;
  articleUrl: string; title: string; description: string | null;
  publishedAt: number | null; summaryRu: string | null;
  keyPoints: string[]; topicTags: string[]; collectedAt: number;
}

export interface InsertNewsItem {
  sourceId: string; sourceName: string; sourceUrl: string; articleUrl: string;
  title: string; description?: string | null; publishedAt?: number | null;
  summaryRu?: string | null; keyPoints?: string[]; topicTags?: string[];
}

function toItem(row: RawRow): NewsItem {
  return {
    id: row.id, sourceId: row.source_id, sourceName: row.source_name,
    sourceUrl: row.source_url, articleUrl: row.article_url, title: row.title,
    description: row.description, publishedAt: row.published_at ? Number(row.published_at) : null,
    summaryRu: row.summary_ru,
    keyPoints: row.key_points ? JSON.parse(row.key_points) : [],
    topicTags: row.topic_tags ? JSON.parse(row.topic_tags) : [],
    collectedAt: Number(row.collected_at),
  };
}

export async function insertNewsItem(item: InsertNewsItem): Promise<boolean> {
  const db = await getDB();
  return db.insert({
    id: `news_${randomUUID().slice(0, 10)}`,
    sourceId: item.sourceId, sourceName: item.sourceName,
    sourceUrl: item.sourceUrl, articleUrl: item.articleUrl,
    title: item.title, description: item.description ?? null,
    publishedAt: item.publishedAt ?? null, summaryRu: item.summaryRu ?? null,
    keyPoints: JSON.stringify(item.keyPoints ?? []),
    topicTags: JSON.stringify(item.topicTags ?? []),
    collectedAt: Math.floor(Date.now() / 1000),
  });
}

export async function urlExists(articleUrl: string): Promise<boolean> {
  const db = await getDB();
  return db.urlExists(articleUrl);
}

export async function listRecentItems(sinceHours = 28): Promise<NewsItem[]> {
  const db = await getDB();
  const rows = await db.listRecent(sinceHours);
  return rows.map(toItem);
}

export async function deleteOldItems(): Promise<number> {
  const db = await getDB();
  return db.deleteOld();
}
