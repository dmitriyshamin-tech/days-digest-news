export interface NewsSource {
  id: string;
  name: string;
  category: "international" | "ukrainian";
  rssUrl?: string;
  baseUrl: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  // ── Міжнародні: e-commerce & retail ──
  { id: "distillery",   name: "Distillery Blog",             category: "international", rssUrl: "https://distillery.com/blog/feed/",                        baseUrl: "https://distillery.com/blog/" },
  { id: "salsify",      name: "Salsify Blog",                category: "international", rssUrl: "https://www.salsify.com/blog/feed/",                       baseUrl: "https://www.salsify.com/blog/" },
  { id: "retaildive",   name: "Retail Dive",                 category: "international", rssUrl: "https://www.retaildive.com/feeds/news/",                   baseUrl: "https://www.retaildive.com/" },
  { id: "dc360",        name: "Digital Commerce 360",        category: "international", rssUrl: "https://www.digitalcommerce360.com/feed/",                 baseUrl: "https://www.digitalcommerce360.com/" },
  { id: "practecom",    name: "Practical Ecommerce",         category: "international", rssUrl: "https://www.practicalecommerce.com/feed",                  baseUrl: "https://www.practicalecommerce.com/" },
  { id: "pymnts",       name: "PYMNTS",                      category: "international", rssUrl: "https://www.pymnts.com/feed/",                             baseUrl: "https://www.pymnts.com/" },

  // ── Міжнародні: AI & tech ──
  { id: "venturebeat",  name: "VentureBeat",                 category: "international", rssUrl: "https://venturebeat.com/feed/",                            baseUrl: "https://venturebeat.com/" },
  { id: "mit",          name: "MIT Technology Review",       category: "international", rssUrl: "https://www.technologyreview.com/feed/",                   baseUrl: "https://www.technologyreview.com/" },
  { id: "arxiv",        name: "arXiv AI",                    category: "international", rssUrl: "https://rss.arxiv.org/rss/cs.AI",                          baseUrl: "https://arxiv.org/" },

  // ── Міжнародні: marketing & consumers ──
  { id: "minders",      name: "minders.io",                  category: "international", rssUrl: "https://minders.io/feed/",                                 baseUrl: "https://minders.io/" },
  { id: "sej",          name: "Search Engine Journal",       category: "international", rssUrl: "https://www.searchenginejournal.com/feed/",                baseUrl: "https://www.searchenginejournal.com/" },
  { id: "hubspot",      name: "HubSpot Marketing Blog",      category: "international", rssUrl: "https://blog.hubspot.com/marketing/rss.xml",               baseUrl: "https://blog.hubspot.com/marketing/" },

  // ── Міжнародні: wellness, furniture & lifestyle ──
  { id: "gwi",          name: "Global Wellness Institute",   category: "international", rssUrl: "https://globalwellnessinstitute.org/feed/",                baseUrl: "https://globalwellnessinstitute.org/" },
  { id: "furnituretoday", name: "Furniture Today",           category: "international", rssUrl: "https://www.furnituretoday.com/feed/",                     baseUrl: "https://www.furnituretoday.com/" },

  // ── Міжнародні: finance & macro ──
  { id: "yahoo",        name: "Yahoo Finance",               category: "international", rssUrl: "https://finance.yahoo.com/news/rssindex",                  baseUrl: "https://finance.yahoo.com/" },
  { id: "reuters",      name: "Reuters Business",            category: "international", rssUrl: "https://feeds.reuters.com/reuters/businessNews",           baseUrl: "https://www.reuters.com/business/" },

  // ── Українські: бізнес & технології ──
  { id: "ain",          name: "AIN.ua",                      category: "ukrainian",     rssUrl: "https://ain.ua/feed/",                                     baseUrl: "https://ain.ua/" },
  { id: "mctoday",      name: "MC.today",                    category: "ukrainian",     rssUrl: "https://mc.today/feed/",                                   baseUrl: "https://mc.today/" },
  { id: "mind",         name: "Mind.ua",                     category: "ukrainian",     rssUrl: "https://mind.ua/rss/",                                     baseUrl: "https://mind.ua/" },
  { id: "forbes_ua",    name: "Forbes Ukraine",              category: "ukrainian",     rssUrl: "https://forbes.ua/api/rss",                                baseUrl: "https://forbes.ua/" },

  // ── Українські: маркетинг & e-commerce ──
  { id: "cases",        name: "CASES.media",                 category: "ukrainian",     rssUrl: "https://cases.media/feed",                                 baseUrl: "https://cases.media/" },
  { id: "marketer",     name: "Marketer.ua",                 category: "ukrainian",     rssUrl: "https://marketer.ua/feed/",                                baseUrl: "https://marketer.ua/" },
  { id: "retailers",    name: "Retailers.ua",                category: "ukrainian",     rssUrl: "https://retailers.ua/feed/",                               baseUrl: "https://retailers.ua/" },
  { id: "listex",       name: "Listex.info",                 category: "ukrainian",     rssUrl: "https://listex.info/feed/",                                baseUrl: "https://listex.info/" },
  { id: "uam",          name: "Маркетинг в Україні",         category: "ukrainian",     rssUrl: "https://www.uam.in.ua/feed/",                              baseUrl: "https://www.uam.in.ua/" },
];
