# Festival Atlas website: 50 improvements, ranked by importance

The ranking is based on what the research database already contains (official selections 2010–2026, synopsis-grounded AI analysis, director history, validation report) and on patterns from comparable sites: the official festival archives (festival-cannes.com, labiennale.org, berlinale.de), Letterboxd, MUBI, IMDb, Festival Scope, Wikidata and Filmfreeway.

How the ranking was made:
1. Without the item, the site cannot serve its purpose: festival discovery plus recommendation, in Persian and English.
2. The item protects research honesty (sources, verification, "Unknown").
3. Value to users, divided by effort.
4. Items that need data we do not have yet (posters, trailers, other festivals' research) rank lower.

**Status:** ✅ = implemented in this version (items 1–20). The rest are planned.

## Core

| # | Improvement | Why | Status |
|---|---|---|---|
| 1 | Bilingual interface (Persian + English) with full right-to-left layout, Persian digits and a Persian font | Required by the project; Persian readers are the main audience | ✅ |
| 2 | Multi-festival architecture: a festival index, a festival switcher, one data file per festival from the same pipeline | Cannes now; Venice, Berlin, etc. plug in without code changes | ✅ |
| 3 | Instant search over title, original title, director, keywords and themes (ignores accents and case, so "Cinéfondation" = "cinefondation") | The most common task on film archive sites | ✅ |
| 4 | Faceted filters: year, section, standard category, country, award winners, theme, mood, runtime | Like Letterboxd and MUBI browsing; uses the database's structured fields | ✅ |
| 5 | Shareable URLs: every page and filter state is in the address, so links can be shared and bookmarked | Needed for citing, sharing and teaching | ✅ |
| 6 | Film pages: titles, directors, countries, runtime, synopsis, every festival appearance, awards, AI analysis | The basic unit of the database | ✅ |
| 7 | Director pages: all of the director's films and awards at the festival, plus repeat-appearance info | Uses the Directors sheet; people browse by auteur | ✅ |
| 8 | "Similar films" recommender (content-based: themes, keywords, mood, tone, synopsis words, section) | The stated goal of the database: an AI festival recommender | ✅ |
| 9 | Discover by mood and theme: pick moods or themes and get ranked suggestions | Recommendation for users who do not know any titles | ✅ |
| 10 | Awards / palmarès page by year (main prize first) | Awards are the most-searched festival facts | ✅ |
| 11 | Edition pages (one per year): edition number, programs, counts, winners | Follows the brief's Festival → Year → Program hierarchy | ✅ |
| 12 | Program pages: standard category, type, official vs extracted count, film list | Keeps the strict program separation from the brief | ✅ |
| 13 | Source transparency on every record: official link, extra sources, verification badge, "Unknown" shown as such | The research-honesty rule of the brief, visible to users | ✅ |
| 14 | Data-quality page: the validation report (Complete / Partial / Unknown, missing films, notes) | Lets reviewers check coverage; important for a PhD project | ✅ |
| 15 | Statistics dashboard: films per year, sections, top countries, directors who returned most often, award share | Quick insight; the charts link back to filtered lists | ✅ |
| 16 | Watchlist / favourites saved in the browser | A common retention feature on film sites | ✅ |
| 17 | Export the current filtered list as CSV | Researchers want subsets of the data | ✅ |
| 18 | Download page for the full deliverables (XLSX, JSON, SQLite) with methodology and how to cite | Openness and reproducibility | ✅ |
| 19 | Light/dark theme (follows the system setting, can be switched by hand) | Comfort; a standard expectation | ✅ |
| 20 | Responsive and accessible: mobile layout, keyboard use, skip link, ARIA live result counts, contrast | Most visitors are on phones; accessibility | ✅ |

## Next

| # | Improvement | Why |
|---|---|---|
| 21 | Add the next festivals' research (Venice, Berlinale, then Sundance, TIFF, Locarno, Karlovy Vary, Rotterdam) with the same pipeline | Turns the site into a multi-festival atlas |
| 22 | Cross-festival identity: one film page that links its Cannes, Venice and Berlin appearances | Shows festival circuits |
| 23 | Cross-festival search and recommendations | "Films like X at any festival" |
| 24 | Wikidata / IMDb / TMDb IDs per film (verified matches only) | External links and enrichment without guessing |
| 25 | Persian titles and synopses, from verified Persian sources or clearly marked as translations | Fully Persian browsing |
| 26 | Pre-rendered static film pages with sitemap.xml and OpenGraph tags | Search engines and link previews |
| 27 | World map of producing countries | Visual entry point |
| 28 | Director timelines: festival career across years and festivals | Auteur studies |
| 29 | Semantic search over synopses (embeddings, computed offline) | "A film about a mother searching for her son" |
| 30 | "Ask the festival" chat assistant that answers from the database with citations | AI front end for the recommender |
| 31 | "Report an error" button that opens a GitHub issue with the record ID filled in | Community correction with review |
| 32 | Theme explorer / keyword network graph | Shows how themes cluster |
| 33 | Compare two editions (sections, countries, themes) | Trend analysis |
| 34 | Trend charts of themes and moods over years | Research insight |
| 35 | Debut-film and woman-director indicators (only where officially stated) | Representation studies; needs a verified source |
| 36 | Poster images via a licensed API (e.g. TMDb, with attribution) | Visual appeal; licensing needed |
| 37 | Trailer embeds (official channels only) | Engagement |
| 38 | Where to watch (JustWatch-type links by country) | Turns discovery into viewing |
| 39 | User accounts and synced lists (e.g. Supabase) | Watchlists across devices |
| 40 | User ratings and reviews | Social layer, collaborative filtering |
| 41 | Collaborative-filtering recommendations (once ratings exist) | Improves the recommender |
| 42 | Offline / installable app (PWA) | Usable during festivals with poor network |
| 43 | Public read-only API (static JSON endpoints plus a schema document) | Reuse by other researchers |
| 44 | Data versioning and changelog page | Reproducibility |
| 45 | Festival calendar with upcoming editions and submission deadlines | Practical use for filmmakers |
| 46 | Jury members per edition | Completes the festival picture |
| 47 | Print-friendly / PDF lists | Teaching and programming |
| 48 | Newsletter or RSS when a new edition is added | Engagement |
| 49 | Embeddable widgets (e.g. "Palme d'Or winners") | Spreads the reach |
| 50 | Usage analytics that respect privacy (e.g. Plausible) | Learn what users need |
