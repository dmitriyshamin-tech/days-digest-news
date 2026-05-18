export interface NewsSource {
  id: string;
  name: string;
  category: "international" | "ukrainian";
  rssUrl?: string;
  baseUrl: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  // ── Міжнародні ──
  { id: "distillery",   name: "Distillery Blog",             category: "international", rssUrl: "https://distillery.com/blog/feed/",              baseUrl: "https://distillery.com/blog/" },
  { id: "salsify",      name: "Salsify Blog",                category: "international", rssUrl: "https://www.salsify.com/blog/feed/",             baseUrl: "https://www.salsify.com/blog/" },
  { id: "gwi",          name: "Global Wellness Institute",   category: "international", rssUrl: "https://globalwellnessinstitute.org/feed/",       baseUrl: "https://globalwellnessinstitute.org/" },
  { id: "yahoo",        name: "Yahoo Finance",               category: "international", rssUrl: "https://finance.yahoo.com/news/rssindex",         baseUrl: "https://finance.yahoo.com/" },
  { id: "minders",      name: "minders.io",                  category: "international", rssUrl: "https://minders.io/feed/",                        baseUrl: "https://minders.io/" },
  { id: "arxiv",        name: "arXiv AI",                    category: "international", rssUrl: "https://rss.arxiv.org/rss/cs.AI",                 baseUrl: "https://arxiv.org/" },
  { id: "mit",          name: "MIT Technology Review",       category: "international", rssUrl: "https://www.technologyreview.com/feed/",          baseUrl: "https://www.technologyreview.com/" },
  { id: "venturebeat",  name: "VentureBeat",                 category: "international", rssUrl: "https://venturebeat.com/feed/",                   baseUrl: "https://venturebeat.com/" },
  { id: "reuters",      name: "Reuters Business",            category: "international", rssUrl: "https://feeds.reuters.com/reuters/businessNews",  baseUrl: "https://www.reuters.com/business/" },
  // ── Українські ──
  { id: "cases",        name: "CASES.media",                 category: "ukrainian",     rssUrl: "https://cases.media/feed",                        baseUrl: "https://cases.media/" },
  { id: "listex",       name: "Listex.info",                 category: "ukrainian",     rssUrl: "https://listex.info/feed/",                       baseUrl: "https://listex.info/" },
  { id: "uam",          name: "Маркетинг в Україні",         category: "ukrainian",     rssUrl: "https://www.uam.in.ua/feed/",                     baseUrl: "https://www.uam.in.ua/" },
  { id: "marketer",     name: "Marketer.ua",                 category: "ukrainian",     rssUrl: "https://marketer.ua/feed/",                       baseUrl: "https://marketer.ua/" },
  { id: "retailers",    name: "Retailers.ua",                category: "ukrainian",     rssUrl: "https://retailers.ua/feed/",                      baseUrl: "https://retailers.ua/" },
  { id: "forbes_ua",    name: "Forbes Ukraine",              category: "ukrainian",     rssUrl: "https://forbes.ua/api/rss",                       baseUrl: "https://forbes.ua/" },
];
