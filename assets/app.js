/* Festival Atlas – static single-page app (no build step).
   Data: data/festivals.json (manifest) + data/<slug>.json per festival,
   produced by `python -m festival_db site`. Routes live in the URL hash so
   every page and filter state can be shared. */
(() => {
  "use strict";

  // ---------- basics ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const state = {
    lang: document.documentElement.lang === "fa" ? "fa" : "en",
    manifest: null, fests: {}, current: null,
    watch: new Set(store.get("watchlist", [])),
    lastPath: null,
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (key, vars) => {
    let s = (I18N[state.lang] && I18N[state.lang][key]) ?? I18N.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  };
  const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const num = (n) => state.lang === "fa" ? String(n).replace(/\d/g, (d) => FA_DIGITS[d]) : String(n);
  const fmt = (n) => { const x = Number(n).toLocaleString("en-US"); return state.lang === "fa" ? num(x).replace(/,/g, "٬") : x; };
  // Persian name for a controlled value; compound names ("Out of Competition - Fiction",
  // "Generation 14plus (out of competition)", "Non-competitive (series)") are translated part by part.
  const term = (v) => {
    if (state.lang !== "fa" || v == null) return v;
    if (FA_TERMS[v]) return FA_TERMS[v];
    const m = String(v).match(/^(.*?)\s*\(([^()]*)\)$/);
    if (m && (FA_TERMS[m[1]] || FA_TERMS[m[2]])) return `${term(m[1])} (${FA_TERMS[m[2]] || m[2]})`;
    if (String(v).includes(" - ")) {
      const parts = String(v).split(" - ");
      if (parts.some((p) => FA_TERMS[p] || FA_TERMS[p.replace(/\s*\(.*\)$/, "")])) return parts.map(term).join(" – ");
    }
    return v;
  };
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const en = (s, tag = "span") => `<${tag} class="content-en" lang="en" dir="ltr">${esc(s)}</${tag}>`;
  const bdi = (s) => `<bdi>${esc(s)}</bdi>`;
  const ordinal = (n) => {
    n = Number(n); if (!n) return "";
    if (state.lang === "fa") return t("editionN", { n: num(n) });
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return t("editionN", { n: n }).replace(`${n}th`, n + (s[(v - 20) % 10] || s[v] || s[0]));
  };
  const announce = (msg) => { const l = $("#live"); l.textContent = ""; setTimeout(() => (l.textContent = msg), 30); };

  // ---------- awards ranking (main prizes first) ----------
  const AWARD_RANK = [
    /^palme d'or( \(ex-aequo\))?$/i, /^special palme d'or/i, /^golden (lion|bear)$/i, /^grand (prix|jury prize)/i,
    /award for best director|silver (lion|bear).*director/i, /^jury prize( \(ex-aequo\))?$/i,
    /award for best actress|award for best actor|volpi|best (leading )?performance/i, /award for best screenplay/i,
    /cam[ée]ra d'or( \(ex-aequo\))?$/i, /^palme d'or - short film/i,
    /un certain regard prize/i, /jury.?s prize - un certain regard|special jury prize - un certain regard/i,
    /un certain regard/i, /cin[ée]fondation|la cinef/i, /short film/i, /./,
  ];
  const awardRank = (a) => AWARD_RANK.findIndex((r) => r.test(a));
  const MAIN_PRIZE_MAX = 9;

  // ---------- data ----------
  async function loadManifest() {
    if (state.manifest) return state.manifest;
    const r = await fetch("data/festivals.json");
    state.manifest = await r.json();
    return state.manifest;
  }
  async function loadCatalog() {
    if (state.catalog !== undefined) return state.catalog;
    try { const r = await fetch("data/catalog.json"); state.catalog = r.ok ? await r.json() : null; } catch (e) { state.catalog = null; }
    return state.catalog;
  }
  async function loadFest(slug) {
    if (state.fests[slug]) return state.fests[slug];
    const m = await loadManifest();
    const entry = m.festivals.find((f) => f.slug === slug);
    if (!entry) return null;
    const r = await fetch(entry.file);
    const F = await r.json();
    F.entry = entry;
    F.byId = new Map(F.films.map((f) => [f.id, f]));
    F.dirById = new Map(F.directors.map((d) => [d.id, d]));
    F.years = [...new Set(F.programs.map((p) => p.y))].sort((a, b) => a - b);
    const order = F.meta.programOrder || [];
    const pidx = (n) => { const i = order.indexOf(n); return i < 0 ? 999 : i; };
    F.programs.sort((a, b) => a.y - b.y || pidx(a.name) - pidx(b.name) || a.name.localeCompare(b.name));
    F.sections = [...new Set(F.programs.map((p) => p.name))].sort((a, b) => pidx(a) - pidx(b));
    F.categories = [...new Set(F.programs.map((p) => p.cat))].sort();
    const count = (arr) => { const m = new Map(); arr.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };
    F.countries = count(F.films.flatMap((f) => f.c));
    F.moods = count(F.films.flatMap((f) => f.mood));
    F.keywords = count(F.films.flatMap((f) => f.kw));
    F.dirFilms = new Map();
    for (const f of F.films) {
      f.s = fold([f.t, f.ot, f.dn.join(" "), f.kw.join(" "), f.mt, f.st, f.c.join(" "), f.ap.map((a) => a.aw.join(" ")).join(" ")].join(" | "));
      f.awards = f.ap.reduce((n, a) => n + a.aw.length, 0);
      f.first = Math.min(...f.ap.map((a) => a.y));
      f.last = Math.max(...f.ap.map((a) => a.y));
      for (const d of f.d) { if (!F.dirFilms.has(d)) F.dirFilms.set(d, []); F.dirFilms.get(d).push(f); }
    }
    state.fests[slug] = F;
    return F;
  }

  // ---------- routing ----------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(qs || "") };
  }
  const link = (...parts) => "#/" + parts.map((p) => encodeURIComponent(p)).join("/");
  const withParams = (base, obj) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) if (v !== "" && v != null && v !== false) p.set(k, v);
    const s = p.toString(); return s ? `${base}?${s}` : base;
  };

  const FEST_VIEWS = {
    "": viewFestival, films: viewBrowse, film: viewFilm, directors: viewDirectors, director: viewDirector,
    year: viewYear, awards: viewAwards, discover: viewDiscover, stats: viewStats, quality: viewQuality, data: viewData,
  };

  async function route() {
    const { parts, params } = parseHash();
    const main = $("#main");
    const pathKey = parts.join("/");
    const changedPage = pathKey !== state.lastPath;
    state.lastPath = pathKey;
    let out;
    try {
      const m = await loadManifest();
      if (!parts.length) out = viewHome(m, await loadCatalog());
      else if (parts[0] === "catalog") out = viewCatalog(await loadCatalog());
      else if (parts[0] === "watchlist") out = await viewWatchlist(m);
      else if (parts[0] === "about") out = viewAbout(m);
      else if (parts[0] === "roadmap") out = await viewRoadmap();
      else if (parts[0] === "search") out = await viewSearch(m, params);
      else {
        const F = await loadFest(parts[0]);
        if (!F) out = { html: `<p>${t("notFound")}</p>` };
        else {
          state.current = F.meta.slug; store.set("festival", state.current);
          const v = FEST_VIEWS[parts[1] || ""];
          out = v ? v(F, parts.slice(2), params) : { html: `<p>${t("notFound")}</p>` };
        }
      }
    } catch (e) {
      console.error(e);
      out = { html: `<p class="notice">Error: ${esc(e.message)}</p>` };
    }
    renderChrome(parts);
    main.innerHTML = out.html;
    document.title = (out.title ? out.title + " · " : "") + t("siteName");
    if (out.after) out.after();
    if (changedPage) { window.scrollTo(0, 0); if (parts.length) main.focus({ preventScroll: true }); }
  }

  // ---------- chrome ----------
  function currentSlug() {
    const m = state.manifest; if (!m || !m.festivals.length) return null;
    return state.current || store.get("festival", null) || m.festivals[0].slug;
  }
  function renderChrome(parts) {
    const slug = currentSlug();
    const sec = parts[0] && parts[0] !== "watchlist" && parts[0] !== "about" ? (parts[1] || "") : parts[0] || "home";
    const items = [["home", "#/", "home"]];
    if (slug) {
      items.push(["", link(slug), "festivals"], ["films", link(slug, "films"), "browse"], ["directors", link(slug, "directors"), "directors"],
        ["awards", link(slug, "awards"), "awards"], ["discover", link(slug, "discover"), "discover"], ["stats", link(slug, "stats"), "stats"],
        ["quality", link(slug, "quality"), "quality"], ["data", link(slug, "data"), "data"]);
    }
    items.push(["watchlist", "#/watchlist", "watchlist"]);
    const m = state.manifest;
    let sw = "";
    if (m && m.festivals.length > 1) {
      sw = `<label class="sr-only" for="fest-switch">${t("festivals")}</label><select id="fest-switch" class="fest-switch">${m.festivals.map((f) => `<option value="${esc(f.slug)}" ${f.slug === slug ? "selected" : ""}>${esc(term(f.name))}</option>`).join("")}</select>`;
    }
    $("#nav").innerHTML = sw + items.map(([key, href, label]) => {
      const cur = (key === "home" && sec === "home") || (key !== "home" && parts[0] && (key === sec || (key === "watchlist" && parts[0] === "watchlist")) && !(key === "" && parts[0] === "watchlist"));
      const lab = key === "" && slug ? term(m.festivals.find((f) => f.slug === slug)?.name || t("festivals")) : t(label);
      return `<a href="${href}" ${cur ? 'aria-current="page"' : ""}>${esc(lab)}${key === "watchlist" && state.watch.size ? ` (${num(state.watch.size)})` : ""}</a>`;
    }).join("");
    const fs = $("#fest-switch");
    if (fs) fs.onchange = () => { location.hash = link(fs.value); };
    $("#brand-name").textContent = t("siteName");
    $("#skip").textContent = t("skip");
    $("#lang-btn").textContent = t("lang");
    const th = document.documentElement.dataset.theme;
    const isDark = th ? th === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    $("#theme-btn").textContent = isDark ? "☀" : "☾";
    $("#theme-btn").setAttribute("aria-label", `${t("theme")}: ${th === "dark" ? t("dark") : th === "light" ? t("light") : "auto"}`);
    $("#footer").innerHTML = `<span>${t("siteName")} · ${t("tagline")}</span>
      <span><a href="#/about">${t("about")}</a> · <a href="#/roadmap">${t("stillPlanned")}</a></span>`;
  }

  // ---------- shared fragments ----------
  const watchKey = (F, f) => `${F.meta.slug}:${f.id}`;
  function star(F, f) {
    const on = state.watch.has(watchKey(F, f));
    return `<button class="star" type="button" data-w="${esc(watchKey(F, f))}" aria-pressed="${on}" aria-label="${esc(on ? t("removeWatch") : t("addWatch"))}: ${esc(f.t)}" title="${esc(on ? t("removeWatch") : t("addWatch"))}">${on ? "★" : "☆"}</button>`;
  }
  function dirLinks(F, f) {
    if (!f.d.length) return f.dn.length ? f.dn.map(bdi).join(", ") : t("unknown");
    return f.d.map((id) => `<a href="${link(F.meta.slug, "director", id)}">${bdi(F.dirById.get(id)?.n || id)}</a>`).join(", ");
  }
  function apChips(F, aps) {
    return aps.map((a) => `<a class="chip" href="${link(F.meta.slug, "year", String(a.y), a.p)}">${num(a.y)} · ${esc(term(a.p))}</a>` +
      a.aw.map((w) => `<span class="chip award" title="${esc(w)}">🏆 ${bdi(w)}</span>`).join("")).join("");
  }
  function filmCard(F, f, aps = f.ap, showSyn = true) {
    const sub = [f.ot ? bdi(f.ot) : "", dirLinks(F, f), f.c.length ? esc(f.c.map(term).join(state.lang === "fa" ? "، " : ", ")) : "", f.rt ? `${num(f.rt)} ${t("minutes")}` : ""].filter(Boolean).join(" · ");
    return `<article class="card film-card">
      <div><h3><a href="${link(F.meta.slug, "film", f.id)}">${bdi(f.t)}</a></h3><div class="sub">${sub}</div></div>
      <div>${star(F, f)}</div>
      <div class="chips">${apChips(F, aps)}</div>
      ${showSyn && f.syn ? `<p class="syn content-en" lang="en" dir="ltr">${esc(f.syn)}</p>` : ""}
    </article>`;
  }
  function miniCard(F, f, extra = "") {
    return `<div class="card mini"><a href="${link(F.meta.slug, "film", f.id)}">${bdi(f.t)}</a>
      <div class="small muted">${f.dn.map(bdi).join(", ")} · ${num(f.first)}</div>${extra}</div>`;
  }
  function verChip(a) {
    return /^official/i.test(a.ver) ? `<span class="chip ok">✓ ${t("verifiedOfficial")}</span>` : `<span class="chip warn">⚠ ${t("supplementary")}</span>`;
  }
  function statusChip(s) {
    const cls = s === "Complete" ? "ok" : s === "Partial" ? "bad" : "warn";
    return `<span class="chip ${cls}">${esc(term(s))}</span>`;
  }
  function bars(rows, max, hrefFn) {
    max = max || Math.max(1, ...rows.map((r) => r[1]));
    return `<div class="bars">${rows.map(([label, n]) => {
      const lab = hrefFn ? `<a class="lab" href="${hrefFn(label)}">${esc(term(label))}</a>` : `<span class="lab">${esc(term(label))}</span>`;
      return `<div class="bar">${lab}<div class="track" aria-hidden="true"><div class="fill" style="width:${(100 * n / max).toFixed(1)}%"></div></div><span>${fmt(n)}</span></div>`;
    }).join("")}</div>`;
  }
  function csvDownload(name, header, rows) {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [header, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function filmsCsv(F, films, name) {
    csvDownload(name, ["Film ID", "Film Title", "Original Title", "Director", "Festival Years", "Programs", "Country of Production",
      "Runtime (min)", "Awards", "Main Theme", "Secondary Theme", "Keywords", "Mood", "Tone", "Official Festival Source"],
      films.map((f) => [f.id, f.t, f.ot || f.t, f.dn.join("; "), f.ap.map((a) => a.y).join("; "), f.ap.map((a) => `${a.y}: ${a.p}`).join("; "),
        f.c.join("; ") || "Unknown", f.rt || "Unknown", f.ap.flatMap((a) => a.aw).join("; ") || "Unknown", f.mt || "Unknown", f.st || "Unknown",
        f.kw.join("; ") || "Unknown", f.mood.join("; ") || "Unknown", f.tone.join("; ") || "Unknown", f.ap.map((a) => a.src).filter(Boolean).join("; ") || "Unknown"]));
  }
  const crumbs = (items) => `<nav class="crumbs" aria-label="breadcrumb">${items.map(([href, label]) => href ? `<a href="${href}">${label}</a>` : `<span>${label}</span>`).join(" / ")}</nav>`;

  // ---------- views ----------
  const PLANNED = [
    ["Venice International Film Festival", "labiennale.org"], ["Berlin International Film Festival", "berlinale.de"],
    ["Sundance Film Festival", "festival.sundance.org"], ["Toronto International Film Festival", "tiff.net"],
    ["Locarno Film Festival", "locarnofestival.ch"], ["International Film Festival Rotterdam", "iffr.com"],
  ];
  function viewHome(m, cat) {
    const fests = m.festivals;
    const cnt = {}; (cat ? cat.festivals : []).forEach((f) => (cnt[f.status] = (cnt[f.status] || 0) + 1));
    const tot = fests.reduce((a, f) => ({ films: a.films + f.films, dirs: a.dirs + f.directors, ap: a.ap + f.appearances }), { films: 0, dirs: 0, ap: 0 });
    const slug = currentSlug();
    return {
      html: `<section class="hero"><h1>${t("siteName")}</h1><p>${t("tagline")}</p>
        <form id="home-search" role="search" style="max-width:640px;margin-top:16px">
          <label class="sr-only" for="hq">${t("search")}</label>
          <input id="hq" class="search-big" type="search" placeholder="${esc(t("searchPlaceholder"))}" autocomplete="off">
        </form></section>
        <div class="grid cols-4" style="margin:20px 0">
          <div class="card stat"><div class="n">${fmt(fests.length)}</div><div class="l">${t("festivals")}</div></div>
          <div class="card stat"><div class="n">${fmt(tot.films)}</div><div class="l">${t("films")}</div></div>
          <div class="card stat"><div class="n">${fmt(tot.ap)}</div><div class="l">${t("appearances")}</div></div>
          <div class="card stat"><div class="n">${fmt(tot.dirs)}</div><div class="l">${t("directorsN")}</div></div>
        </div>
        <h2>${t("festivals")}</h2>
        <div class="grid cols-3">${fests.map((f) => `<article class="card fest-card"><h3><a href="${link(f.slug)}">${esc(term(f.name))}</a></h3>
          <p class="muted small">${num(f.start)}–${num(f.end)} · ${fmt(f.films)} ${t("films")} · ${fmt(f.programs)} ${t("programs")}</p>
          <div class="chips"><span class="chip ok">${t("programsComplete", { a: num(f.complete), b: num(f.programs) })}</span>
          <span class="chip">${fmt(f.analysed)} ${t("analysed")}</span></div>
          <p style="margin:12px 0 0"><a class="btn primary" href="${link(f.slug)}">${t("openFestival")}</a></p></article>`).join("")}
        </div>
        ${cat ? `<section class="card" style="margin-top:14px"><h3>${t("catalogTitle")}</h3>
          <p class="muted">${t("catalogSummary", { p: num(cnt.published || 0), i: num(cnt.in_progress || 0), l: num(cnt.planned || 0) })}</p>
          <a class="btn primary" href="#/catalog">${t("catalogOpen")} (${num(cat.festivals.length)})</a></section>` : ""}
        <p class="muted small" style="margin-top:10px">${t("plannedNote")} <a href="#/roadmap">${t("roadmap")}</a></p>`,
      after() {
        $("#home-search").onsubmit = (e) => { e.preventDefault(); location.hash = withParams("#/search", { q: $("#hq").value.trim() }); };
      },
    };
  }

  function viewFestival(F) {
    const s = F.meta.slug, e = F.entry;
    const latest = F.years[F.years.length - 1];
    const winners = F.films.flatMap((f) => f.ap.filter((a) => a.y === latest && a.aw.length).flatMap((a) => a.aw.map((w) => ({ f, w })))).sort((a, b) => awardRank(a.w) - awardRank(b.w)).slice(0, 8);
    const perYear = new Map(F.years.map((y) => [y, 0]));
    F.films.forEach((f) => new Set(f.ap.map((a) => a.y)).forEach((y) => perYear.set(y, perYear.get(y) + 1)));
    return {
      title: term(F.meta.name),
      html: `<section class="hero"><h1>${esc(term(F.meta.name))}</h1>
        <p>${num(F.meta.start)}–${num(F.meta.end)} · <a href="${esc(F.meta.website)}" rel="noopener" target="_blank">${esc(F.meta.website.replace(/^https?:\/\//, ""))}</a></p>
        <form id="fs" role="search" style="max-width:640px"><label class="sr-only" for="fq">${t("search")}</label>
        <input id="fq" class="search-big" type="search" placeholder="${esc(t("searchPlaceholder"))}"></form></section>
        <div class="grid cols-4" style="margin:20px 0">
          <a class="card stat" href="${link(s, "films")}"><div class="n">${fmt(e.films)}</div><div class="l">${t("films")}</div></a>
          <a class="card stat" href="${link(s, "directors")}"><div class="n">${fmt(e.directors)}</div><div class="l">${t("directorsN")}</div></a>
          <a class="card stat" href="${link(s, "awards")}"><div class="n">${fmt(e.awards)}</div><div class="l">${t("awardsN")}</div></a>
          <a class="card stat" href="${link(s, "quality")}"><div class="n">${num(e.complete)}/${num(e.programs)}</div><div class="l">${t("quality")}</div></a>
        </div>
        <h2>${t("editions")}</h2>
        <div class="year-grid">${F.years.slice().reverse().map((y) => `<a class="card" href="${link(s, "year", String(y))}">${num(y)}<small>${fmt(perYear.get(y))} ${t("films")}</small></a>`).join("")}</div>
        <div class="grid cols-2" style="margin-top:8px">
          <section><h2>${t("winners")} ${num(latest)}</h2>${winners.length ? `<div class="mini-grid">${winners.map(({ f, w }) => miniCard(F, f, `<div class="chip award" style="margin-top:6px">🏆 ${bdi(w)}</div>`)).join("")}</div>` : `<p class="muted">${t("noWinners")}</p>`}</section>
          <section><h2>${t("explore")}</h2><div class="chips">
            <a class="btn" href="${link(s, "discover")}">✨ ${t("discover")}</a><a class="btn" href="${link(s, "awards")}">🏆 ${t("palmares")}</a>
            <a class="btn" href="${link(s, "stats")}">📊 ${t("stats")}</a><a class="btn" href="${link(s, "quality")}">✔ ${t("quality")}</a>
            <a class="btn" href="${link(s, "data")}">⬇ ${t("downloads")}</a><button class="btn" id="surprise">🎲 ${t("surprise")}</button></div></section>
        </div>`,
      after() {
        $("#fs").onsubmit = (ev) => { ev.preventDefault(); location.hash = withParams(link(s, "films"), { q: $("#fq").value.trim() }); };
        $("#surprise").onclick = () => surprise(F);
      },
    };
  }
  function surprise(F) {
    const pool = F.films.filter((f) => f.syn);
    const f = pool[Math.floor(Math.random() * pool.length)];
    location.hash = link(F.meta.slug, "film", f.id);
  }

  // Browse with facets
  const FILTER_KEYS = ["q", "year", "prog", "cat", "country", "mood", "theme", "aw", "watch", "rmin", "rmax", "sort"];
  function apMatch(a, p) {
    return (!p.year || a.y === +p.year) && (!p.prog || a.p === p.prog) && (!p.cat || a.cat === p.cat) && (!p.aw || a.aw.length > 0);
  }
  function filterFilms(F, p) {
    const terms = fold(p.q).split(/\s+/).filter(Boolean);
    const theme = fold(p.theme);
    let list = F.films.filter((f) => {
      if (terms.length && !terms.every((w) => f.s.includes(w))) return false;
      if (!f.ap.some((a) => apMatch(a, p))) return false;
      if (p.country && !f.c.includes(p.country)) return false;
      if (p.mood && !f.mood.includes(p.mood)) return false;
      if (theme && !fold([f.kw.join(" "), f.mt, f.st].join(" ")).includes(theme)) return false;
      if (p.watch && !state.watch.has(`${F.meta.slug}:${f.id}`)) return false;
      if (p.rmin && !(f.rt >= +p.rmin)) return false;
      if (p.rmax && !(f.rt && f.rt <= +p.rmax)) return false;
      return true;
    });
    const by = {
      "year-asc": (a, b) => a.first - b.first || a.t.localeCompare(b.t),
      title: (a, b) => a.t.localeCompare(b.t),
      runtime: (a, b) => (b.rt || 0) - (a.rt || 0),
      awards: (a, b) => b.awards - a.awards || b.last - a.last,
    }[p.sort] || ((a, b) => b.last - a.last || a.t.localeCompare(b.t));
    return list.sort(by);
  }
  function viewBrowse(F, _rest, params) {
    const s = F.meta.slug;
    const p = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""]));
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`;
    let limit = 60, list = [];
    const html = `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("browse")]])}
      <h1>${t("browse")}</h1>
      <div class="browse">
        <form class="card filters" id="filters" role="search" aria-label="${esc(t("search"))}">
          <label class="field">${t("search")}<input type="search" name="q" value="${esc(p.q)}" placeholder="${esc(t("searchPlaceholder"))}"></label>
          <label class="field">${t("year")}<select name="year">${opt("", t("allYears"), p.year)}${F.years.slice().reverse().map((y) => opt(y, num(y), p.year)).join("")}</select></label>
          <label class="field">${t("section")}<select name="prog">${opt("", t("allSections"), p.prog)}${F.sections.map((x) => opt(x, term(x), p.prog)).join("")}</select></label>
          <label class="field">${t("category")}<select name="cat">${opt("", t("allCategories"), p.cat)}${F.categories.map((x) => opt(x, term(x), p.cat)).join("")}</select></label>
          <label class="field">${t("country")}<select name="country">${opt("", t("allCountries"), p.country)}${F.countries.map(([c, n]) => opt(c, `${term(c)} (${num(n)})`, p.country)).join("")}</select></label>
          <label class="field">${t("mood")}<select name="mood">${opt("", t("allMoods"), p.mood)}${F.moods.slice(0, 80).map(([c, n]) => opt(c, `${c} (${num(n)})`, p.mood)).join("")}</select></label>
          <label class="field">${t("anyTheme")}<input type="search" name="theme" value="${esc(p.theme)}" list="kw-list"></label>
          <datalist id="kw-list">${F.keywords.slice(0, 300).map(([k]) => `<option value="${esc(k)}">`).join("")}</datalist>
          <div class="row2"><label class="field">${t("minRuntime")}<input type="number" min="0" name="rmin" value="${esc(p.rmin)}"></label>
          <label class="field">${t("maxRuntime")}<input type="number" min="0" name="rmax" value="${esc(p.rmax)}"></label></div>
          <label class="check"><input type="checkbox" name="aw" value="1" ${p.aw ? "checked" : ""}> ${t("winnersOnly")}</label>
          <label class="check"><input type="checkbox" name="watch" value="1" ${p.watch ? "checked" : ""}> ${t("inWatchlist")}</label>
          <label class="field">${t("sort")}<select name="sort">${opt("", t("sortYearDesc"), p.sort)}${opt("year-asc", t("sortYearAsc"), p.sort)}${opt("title", t("sortTitle"), p.sort)}${opt("runtime", t("sortRuntime"), p.sort)}${opt("awards", t("sortAwards"), p.sort)}</select></label>
          <button class="btn" type="reset" id="clear">${t("clear")}</button>
        </form>
        <section aria-labelledby="count">
          <div class="results-bar"><strong id="count"></strong>
            <span class="chips"><button class="btn toggle-filters" type="button" id="tf" aria-controls="filters" aria-expanded="false">⚙ ${t("search")}</button>
            <button class="btn" type="button" id="csv">⬇ ${t("exportCsv")}</button></span></div>
          <div class="film-list" id="results"></div>
          <p style="text-align:center"><button class="btn" type="button" id="more" hidden>${t("loadMore")}</button></p>
        </section>
      </div>`;
    function readForm() {
      const fd = new FormData($("#filters"));
      const o = {}; FILTER_KEYS.forEach((k) => (o[k] = (fd.get(k) || "").toString().trim())); return o;
    }
    function draw(reset) {
      if (reset) limit = 60;
      const cur = readForm();
      history.replaceState(null, "", withParams(link(s, "films"), cur));
      state.lastPath = parseHash().parts.join("/");
      list = filterFilms(F, cur);
      const hasApFilter = cur.year || cur.prog || cur.cat || cur.aw;
      $("#results").innerHTML = list.length ? list.slice(0, limit).map((f) => filmCard(F, f, hasApFilter ? f.ap.filter((a) => apMatch(a, cur)) : f.ap)).join("")
        : `<p class="card">${t("noResults")}</p>`;
      const msg = t("results", { n: fmt(list.length) });
      $("#count").textContent = msg; announce(msg);
      $("#more").hidden = list.length <= limit;
    }
    return {
      title: t("browse"), html,
      after() {
        let timer;
        $("#filters").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => draw(true), 150); });
        $("#filters").addEventListener("change", () => draw(true));
        $("#filters").addEventListener("submit", (e) => { e.preventDefault(); draw(true); });
        $("#clear").onclick = (e) => { e.preventDefault(); $$("#filters input, #filters select").forEach((el) => { if (el.type === "checkbox") el.checked = false; else el.value = ""; }); draw(true); };
        $("#more").onclick = () => { limit += 60; draw(false); };
        $("#csv").onclick = () => filmsCsv(F, list, `${s}_films_selection.csv`);
        $("#tf").onclick = () => { const o = $("#filters").classList.toggle("open"); $("#tf").setAttribute("aria-expanded", o); };
        draw(true);
      },
    };
  }

  function viewFilm(F, [id]) {
    const s = F.meta.slug, f = F.byId.get(id);
    if (!f) return { html: `<p>${t("notFound")}</p>` };
    const row = (k, v) => v ? `<dt>${t(k)}</dt><dd>${v}</dd>` : "";
    const ai = f.mt ? `<dl class="meta">
        ${row("mainTheme", en(f.mt))}${row("secondaryTheme", f.st ? en(f.st) : "")}
        ${row("keywords", `<span class="chips">${f.kw.map((k) => `<a class="chip" href="${withParams(link(s, "films"), { theme: k })}">${bdi(k)}</a>`).join("")}</span>`)}
        ${row("mood", `<span class="chips">${f.mood.map((k) => `<a class="chip" href="${withParams(link(s, "films"), { mood: k })}">${bdi(k)}</a>`).join("")}</span>`)}
        ${row("tone", f.tone.length ? en(f.tone.join(", ")) : "")}${row("visualStyle", f.vs ? en(f.vs) : "")}${row("audience", f.aud ? en(f.aud) : "")}
      </dl><p class="small muted" style="margin-bottom:0">${t("aiNote")}</p>` : `<p class="muted">${t("aiMissing")}</p>`;
    const sims = f.sim.map((x) => F.byId.get(x)).filter(Boolean);
    return {
      title: f.t,
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [link(s, "films"), t("browse")], [null, bdi(f.t)]])}
        <div class="film-head"><div><h1>${bdi(f.t)}</h1>${f.ot ? `<p class="muted">${t("originalTitle")}: ${bdi(f.ot)}</p>` : ""}</div><div>${star(F, f)}</div></div>
        <div class="two-col">
          <div>
            <dl class="meta card">
              ${row("directedBy", dirLinks(F, f))}
              ${row("countries", f.c.length ? f.c.map((c) => `<a href="${withParams(link(s, "films"), { country: c })}">${esc(term(c))}</a>`).join(", ") : t("unknown"))}
              ${row("runtime", f.rt ? `${num(f.rt)} ${t("minutes")}` : t("unknown"))}
              ${row("language", f.lang ? bdi(f.lang) : "")}${row("genre", f.genre ? bdi(f.genre) : "")}
            </dl>
            <h2>${t("synopsis")}</h2>
            ${f.syn ? `<p class="content-en" lang="en" dir="ltr">${esc(f.syn)}</p>` : `<p class="muted">${t("noSynopsis")}</p>`}
            ${f.log ? `<p><strong>${t("logline")}:</strong> ${en(f.log)}</p>` : ""}
            <h2>${t("festivalHistory")}</h2>
            <div class="table-wrap"><table><thead><tr><th>${t("year")}</th><th>${t("section")}</th><th>${t("award")}</th><th>${t("verification")}</th><th>${t("sources")}</th></tr></thead><tbody>
            ${f.ap.map((a) => `<tr><td><a href="${link(s, "year", String(a.y))}">${num(a.y)}</a><div class="small muted">${ordinal(a.ed)}</div></td>
              <td><a href="${link(s, "year", String(a.y), a.p)}">${esc(term(a.p))}</a><div class="small muted">${esc(term(a.cat))}</div><div class="small muted content-en">${esc(a.sel)}</div></td>
              <td>${a.aw.length ? a.aw.map((w) => `<div>🏆 ${bdi(w)}</div>`).join("") : `<span class="muted">—</span>`}</td>
              <td>${verChip(a)}</td>
              <td>${a.src ? `<a href="${esc(a.src)}" target="_blank" rel="noopener">${t("officialSource")}</a>` : `<span class="muted">${t("unknown")}</span>`}
                ${a.add.map((u, i) => `<div><a class="small" href="${esc(u)}" target="_blank" rel="noopener">${t("additionalSource")} ${a.add.length > 1 ? num(i + 1) : ""}</a></div>`).join("")}</td></tr>`).join("")}
            </tbody></table></div>
          </div>
          <aside>
            <section class="card ai"><h3>${t("aiAnalysis")} <span class="badge-ai">AI</span></h3>${ai}</section>
          </aside>
        </div>
        ${f.x && f.x.length ? `<h2>${t("alsoAt")}</h2><div class="chips">${f.x.map(([slug, id, ys]) => {
          const fe = state.manifest.festivals.find((m) => m.slug === slug);
          return `<a class="chip award" href="${link(slug, "film", id)}">${esc(term(fe ? fe.name : slug))} · ${ys.map(num).join(", ")}</a>`; }).join("")}</div>` : ""}
        <h2>${t("similar")}</h2>
        ${sims.length ? `<p class="small muted">${t("similarNote")}</p><div class="mini-grid">${sims.map((x) => miniCard(F, x, x.mt ? `<div class="small content-en" style="margin-top:4px">${esc(x.mt)}</div>` : "")).join("")}</div>` : `<p class="muted">${t("noSimilar")}</p>`}`,
    };
  }

  function viewDirectors(F, _r, params) {
    const s = F.meta.slug;
    const rows = F.directors.map((d) => {
      const films = F.dirFilms.get(d.id) || [];
      const years = new Set(films.flatMap((f) => f.ap.map((a) => a.y)));
      return { d, films, years: years.size, awards: films.reduce((n, f) => n + f.awards, 0) };
    });
    let limit = 120;
    return {
      title: t("directors"),
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("directors")]])}<h1>${t("directors")}</h1>
        <div class="results-bar"><input id="dq" type="search" style="max-width:380px" placeholder="${esc(t("directorSearch"))}" aria-label="${esc(t("directorSearch"))}" value="${esc(params.get("q") || "")}">
        <label class="check">${t("sort")}: <select id="ds" style="width:auto"><option value="count">${t("sortByCount")}</option><option value="name">${t("sortByName")}</option></select></label></div>
        <p id="dcount" class="muted"></p>
        <div class="table-wrap"><table><thead><tr><th>${t("directors")}</th><th>${t("films")}</th><th>${t("yearsSelected")}</th><th>${t("awardsWon")}</th></tr></thead><tbody id="dbody"></tbody></table></div>
        <p style="text-align:center"><button class="btn" id="dmore" hidden>${t("loadMore")}</button></p>`,
      after() {
        const draw = (reset) => {
          if (reset) limit = 120;
          const q = fold($("#dq").value), by = $("#ds").value;
          const list = rows.filter((r) => !q || fold(r.d.n).includes(q))
            .sort(by === "name" ? (a, b) => a.d.n.localeCompare(b.d.n) : (a, b) => b.years - a.years || b.awards - a.awards || a.d.n.localeCompare(b.d.n));
          $("#dbody").innerHTML = list.slice(0, limit).map((r) => `<tr><td><a href="${link(s, "director", r.d.id)}">${bdi(r.d.n)}</a></td>
            <td>${r.films.slice(0, 4).map((f) => `<a href="${link(s, "film", f.id)}">${bdi(f.t)}</a>`).join(", ")}${r.films.length > 4 ? " …" : ""}</td>
            <td>${num(r.years)}</td><td>${r.awards ? num(r.awards) : "—"}</td></tr>`).join("");
          $("#dcount").textContent = `${fmt(list.length)} ${t("directorsN")}`;
          $("#dmore").hidden = list.length <= limit;
        };
        $("#dq").oninput = () => draw(true); $("#ds").onchange = () => draw(true);
        $("#dmore").onclick = () => { limit += 120; draw(false); };
        draw(true);
      },
    };
  }

  function viewDirector(F, [id]) {
    const s = F.meta.slug, d = F.dirById.get(id);
    if (!d) return { html: `<p>${t("notFound")}</p>` };
    const films = (F.dirFilms.get(id) || []).slice().sort((a, b) => a.first - b.first);
    const years = [...new Set(films.flatMap((f) => f.ap.map((a) => a.y)))].sort();
    const awards = films.flatMap((f) => f.ap.flatMap((a) => a.aw.map((w) => `${num(a.y)} · ${w}`)));
    const yn = (v) => v === "Yes" ? t("yes") : v === "No" ? t("no") : t("unknown");
    return {
      title: d.n,
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [link(s, "directors"), t("directors")], [null, bdi(d.n)]])}
        <h1>${bdi(d.n)}</h1>
        <div class="grid cols-4" style="margin-bottom:16px">
          <div class="card stat"><div class="n">${num(films.length)}</div><div class="l">${t("films")}</div></div>
          <div class="card stat"><div class="n">${num(years.length)}</div><div class="l">${t("yearsSelected")}</div></div>
          <div class="card stat"><div class="n">${num(awards.length)}</div><div class="l">${t("awardsWon")}</div></div>
        </div>
        <dl class="meta card"><dt>${t("yearsSelected")}</dt><dd>${years.map((y) => `<a href="${link(s, "year", String(y))}">${num(y)}</a>`).join(" · ")}</dd>
          ${awards.length ? `<dt>${t("awardsWon")}</dt><dd>${awards.map((a) => `<div>🏆 ${bdi(a)}</div>`).join("")}</dd>` : ""}
          <dt>${t("prevAppearance")}</dt><dd>${yn(d.pa)}</dd><dt>${t("prevAward")}</dt><dd>${yn(d.pw)}</dd>
          ${d.bio ? `<dt>Bio</dt><dd>${en(d.bio)}</dd>` : ""}</dl>
        <h2>${t("filmsAtFestival")}</h2><div class="film-list">${films.map((f) => filmCard(F, f)).join("")}</div>`,
    };
  }

  function viewYear(F, [y, prog]) {
    const s = F.meta.slug, year = +y;
    const progs = F.programs.filter((p) => p.y === year);
    if (!progs.length) return { html: `<p>${t("notFound")}</p>` };
    const ed = progs[0].ed;
    if (prog) {
      const p = progs.find((x) => x.name === prog);
      if (!p) return { html: `<p>${t("notFound")}</p>` };
      const films = F.films.filter((f) => f.ap.some((a) => a.y === year && a.p === prog)).sort((a, b) => a.t.localeCompare(b.t));
      return {
        title: `${term(prog)} ${y}`,
        html: `${crumbs([[link(s), esc(term(F.meta.name))], [link(s, "year", y), num(y)], [null, esc(term(prog))]])}
          <h1>${esc(term(prog))} · ${num(y)}</h1>
          <dl class="meta card" style="margin-bottom:16px">
            <dt>${t("category")}</dt><dd>${esc(term(p.cat))}</dd><dt>${t("type")}</dt><dd>${esc(term(p.type))}</dd>
            <dt>${t("officialCount")}</dt><dd>${p.off === "Unknown" ? t("unknown") : num(p.off)}</dd>
            <dt>${t("extractedCount")}</dt><dd>${num(p.ext)}</dd><dt>${t("missingFilms")}</dt><dd>${p.miss === "Unknown" ? t("unknown") : num(p.miss)}</dd>
            <dt>${t("status")}</dt><dd>${statusChip(p.status)}</dd>
            <dt>${t("source")}</dt><dd>${p.src && p.src !== "Unknown" ? `<a href="${esc(p.src)}" target="_blank" rel="noopener" class="ltr">${esc(p.src.replace(/^https?:\/\//, ""))}</a>` : t("unknown")}</dd>
            ${p.notes ? `<dt>${t("notes")}</dt><dd>${en(p.notes)}</dd>` : ""}
          </dl>
          <div class="results-bar"><strong>${t("results", { n: fmt(films.length) })}</strong><button class="btn" id="csv">⬇ ${t("exportCsv")}</button></div>
          <div class="film-list">${films.map((f) => filmCard(F, f, f.ap.filter((a) => a.y === year && a.p === prog))).join("")}</div>`,
        after() { $("#csv").onclick = () => filmsCsv(F, films, `${s}_${y}_${prog.replace(/\W+/g, "_")}.csv`); },
      };
    }
    const winners = F.films.flatMap((f) => f.ap.filter((a) => a.y === year).flatMap((a) => a.aw.map((w) => ({ f, w, p: a.p })))).sort((a, b) => awardRank(a.w) - awardRank(b.w));
    const yi = F.years.indexOf(year);
    return {
      title: `${term(F.meta.name)} ${y}`,
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, num(y)]])}
        <h1>${esc(term(F.meta.name))} ${num(y)}</h1><p class="muted">${ordinal(ed)}</p>
        <p class="chips">${yi > 0 ? `<a class="btn" href="${link(s, "year", String(F.years[yi - 1]))}">${num(F.years[yi - 1])}</a>` : ""}
          <a class="btn" href="${withParams(link(s, "films"), { year: y })}">${t("browse")} ${num(y)}</a>
          ${yi < F.years.length - 1 ? `<a class="btn" href="${link(s, "year", String(F.years[yi + 1]))}">${num(F.years[yi + 1])}</a>` : ""}</p>
        <h2>${t("programsThisYear")}</h2>
        <div class="grid cols-3">${progs.map((p) => `<a class="card" href="${link(s, "year", y, p.name)}" style="color:inherit;text-decoration:none">
          <h3>${esc(term(p.name))}</h3><div class="small muted">${esc(term(p.cat))}</div>
          <div class="chips" style="margin-top:8px"><span class="chip">${num(p.ext)} ${t("films")}</span>${statusChip(p.status)}</div></a>`).join("")}</div>
        <h2>${t("winners")}</h2>
        ${winners.length ? `<div class="table-wrap"><table><thead><tr><th>${t("award")}</th><th>${t("film")}</th><th>${t("directedBy")}</th></tr></thead><tbody>
          ${winners.map(({ f, w }) => `<tr><td>🏆 ${bdi(w)}</td><td><a href="${link(s, "film", f.id)}">${bdi(f.t)}</a></td><td>${dirLinks(F, f)}</td></tr>`).join("")}</tbody></table></div>`
          : `<p class="muted">${t("noWinners")}</p>`}`,
    };
  }

  function viewAwards(F, _r, params) {
    const s = F.meta.slug, all = params.get("all") === "1";
    const rows = F.films.flatMap((f) => f.ap.flatMap((a) => a.aw.map((w) => ({ f, a, w, r: awardRank(w) }))))
      .filter((x) => all || x.r <= MAIN_PRIZE_MAX);
    const years = [...new Set(rows.map((x) => x.a.y))].sort((a, b) => b - a);
    return {
      title: t("palmares"),
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("awards")]])}<h1>${t("palmares")}</h1>
        <p class="muted">${t("palmaresNote")}</p>
        <p class="chips"><a class="btn" aria-pressed="${!all}" href="${link(s, "awards")}">${t("mainPrizes")}</a>
          <a class="btn" aria-pressed="${all}" href="${withParams(link(s, "awards"), { all: 1 })}">${t("allPrizes")}</a>
          <a class="btn" href="${withParams(link(s, "films"), { aw: 1, sort: "awards" })}">${t("browse")} 🏆</a></p>
        ${years.map((y) => `<section><h2><a href="${link(s, "year", String(y))}">${num(y)}</a></h2>
          <div class="table-wrap"><table><tbody>${rows.filter((x) => x.a.y === y).sort((a, b) => a.r - b.r || a.w.localeCompare(b.w)).map(({ f, a, w }) => `<tr>
          <td style="width:38%">🏆 ${bdi(w)}</td><td><a href="${link(s, "film", f.id)}">${bdi(f.t)}</a><div class="small muted">${esc(term(a.p))}</div></td><td>${dirLinks(F, f)}</td></tr>`).join("")}
          </tbody></table></div></section>`).join("")}`,
    };
  }

  function viewDiscover(F, _r, params) {
    const s = F.meta.slug;
    const sel = { moods: new Set((params.get("moods") || "").split("|").filter(Boolean)), themes: new Set((params.get("themes") || "").split("|").filter(Boolean)), cats: new Set((params.get("cats") || "").split("|").filter(Boolean)) };
    const moods = F.moods.slice(0, 30), themes = F.keywords.slice(0, 48);
    const chip = (group, v, label) => `<button type="button" class="chip" data-g="${group}" data-v="${esc(v)}" aria-pressed="${sel[group].has(v)}">${esc(label)}</button>`;
    return {
      title: t("discover"),
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("discover")]])}<h1>✨ ${t("discover")}</h1><p class="muted">${t("discoverIntro")}</p>
        ${F.entry.analysed ? "" : `<p class="notice">${t("aiMissing")}</p>`}
        <div class="grid cols-3">
          <section class="card"><h3>${t("pickMoods")}</h3><div class="chips">${moods.map(([m]) => chip("moods", m, m)).join("")}</div></section>
          <section class="card"><h3>${t("pickThemes")}</h3><div class="chips">${themes.map(([k]) => chip("themes", k, k)).join("")}</div></section>
          <section class="card"><h3>${t("pickSections")}</h3><div class="chips">${F.categories.map((c) => chip("cats", c, term(c))).join("")}</div>
            <p style="margin-bottom:0"><button class="btn" id="surprise">🎲 ${t("surprise")}</button></p></section>
        </div>
        <h2 id="dres-h">${t("browse")}</h2><div class="film-list" id="dres"></div>`,
      after() {
        const draw = () => {
          history.replaceState(null, "", withParams(link(s, "discover"), { moods: [...sel.moods].join("|"), themes: [...sel.themes].join("|"), cats: [...sel.cats].join("|") }));
          state.lastPath = parseHash().parts.join("/");
          if (!sel.moods.size && !sel.themes.size) { $("#dres").innerHTML = `<p class="muted">${t("startPicking")}</p>`; return; }
          const scored = F.films.filter((f) => f.mt && (!sel.cats.size || f.ap.some((a) => sel.cats.has(a.cat)))).map((f) => {
            const text = fold([f.kw.join(" "), f.mt, f.st].join(" "));
            let n = 0; sel.moods.forEach((m) => { if (f.mood.includes(m)) n += 2; }); sel.themes.forEach((k) => { if (f.kw.includes(k)) n += 2; else if (text.includes(fold(k))) n += 1; });
            return { f, n };
          }).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || b.f.awards - a.f.awards || b.f.last - a.f.last).slice(0, 40);
          $("#dres").innerHTML = scored.length ? scored.map(({ f, n }) => filmCard(F, f).replace('<div class="chips">', `<div class="chips"><span class="chip ok">${num(n)} ${t("matches")}</span>`)).join("") : `<p class="card">${t("noResults")}</p>`;
          announce(t("results", { n: fmt(scored.length) }));
        };
        $$("[data-g]").forEach((b) => b.onclick = () => {
          const set = sel[b.dataset.g], v = b.dataset.v;
          set.has(v) ? set.delete(v) : set.add(v); b.setAttribute("aria-pressed", set.has(v)); draw();
        });
        $("#surprise").onclick = () => surprise(F);
        draw();
      },
    };
  }

  function viewStats(F) {
    const s = F.meta.slug;
    const perYear = F.years.map((y) => [y, F.films.filter((f) => f.ap.some((a) => a.y === y)).length]);
    const maxY = Math.max(...perYear.map((x) => x[1]));
    const cat = new Map(); F.films.forEach((f) => f.ap.forEach((a) => cat.set(a.cat, (cat.get(a.cat) || 0) + 1)));
    const awardC = new Map(); F.films.forEach((f) => { if (f.awards) f.c.forEach((c) => awardC.set(c, (awardC.get(c) || 0) + 1)); });
    const dirs = F.directors.map((d) => [d, new Set((F.dirFilms.get(d.id) || []).flatMap((f) => f.ap.map((a) => a.y))).size]).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const kws = F.keywords.slice(0, 60), kmax = kws.length ? kws[0][1] : 1;
    return {
      title: t("stats"),
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("stats")]])}<h1>📊 ${t("stats")}</h1>
        <section class="card"><h3>${t("perYear")}</h3>
          <div class="cols" role="list">${perYear.map(([y, n]) => `<a role="listitem" href="${link(s, "year", String(y))}" aria-label="${num(y)}: ${fmt(n)}"><div class="c" style="height:${(100 * n / maxY).toFixed(1)}%"><span>${fmt(n)}</span></div>${num(String(y).slice(2))}</a>`).join("")}</div></section>
        <div class="grid cols-2" style="margin-top:14px">
          <section class="card"><h3>${t("bySection")}</h3>${bars([...cat].sort((a, b) => b[1] - a[1]), 0, (c) => withParams(link(s, "films"), { cat: c }))}</section>
          <section class="card"><h3>${t("topCountries")}</h3>${bars(F.countries.slice(0, 15), 0, (c) => withParams(link(s, "films"), { country: c }))}</section>
          <section class="card"><h3>${t("topDirectors")}</h3><div class="bars">${dirs.map(([d, n]) => `<div class="bar"><a class="lab" href="${link(s, "director", d.id)}">${bdi(d.n)}</a><div class="track"><div class="fill" style="width:${(100 * n / dirs[0][1]).toFixed(1)}%"></div></div><span>${num(n)}</span></div>`).join("")}</div></section>
          <section class="card"><h3>${t("awardCountries")}</h3>${bars([...awardC].sort((a, b) => b[1] - a[1]).slice(0, 15), 0, (c) => withParams(link(s, "films"), { country: c, aw: 1 }))}</section>
        </div>
        ${kws.length ? `<section class="card" style="margin-top:14px"><h3>${t("themesCloud")}</h3><div class="cloud">${kws.map(([k, n]) => `<a href="${withParams(link(s, "films"), { theme: k })}" style="font-size:${(0.8 + 1.1 * n / kmax).toFixed(2)}rem" title="${num(n)}">${bdi(k)}</a>`).join("")}</div></section>` : ""}`,
    };
  }

  function viewQuality(F, _r, params) {
    const s = F.meta.slug, filter = params.get("status") || "";
    const counts = F.programs.reduce((m, p) => (m[p.status] = (m[p.status] || 0) + 1, m), {});
    const list = F.programs.filter((p) => !filter || p.status === filter).sort((a, b) => b.y - a.y);
    const unverified = F.films.reduce((n, f) => n + f.ap.filter((a) => !/^official/i.test(a.ver)).length, 0);
    return {
      title: t("quality"),
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("quality")]])}<h1>✔ ${t("quality")}</h1><p class="muted">${t("qualityIntro")}</p>
        <div class="grid cols-4" style="margin-bottom:14px">
          ${["Complete", "Partial", "Unknown"].map((k) => `<a class="card stat" href="${withParams(link(s, "quality"), { status: filter === k ? "" : k })}" aria-pressed="${filter === k}"><div class="n">${num(counts[k] || 0)}</div><div class="l">${statusChip(k)}</div></a>`).join("")}
          <div class="card stat"><div class="n">${num(unverified)}</div><div class="l">${t("supplementary")}</div></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>${t("year")}</th><th>${t("section")}</th><th>${t("officialCount")}</th><th>${t("extractedCount")}</th><th>${t("missingFilms")}</th><th>${t("status")}</th><th>${t("notes")}</th></tr></thead><tbody>
        ${list.map((p) => `<tr><td>${num(p.y)}</td><td><a href="${link(s, "year", String(p.y), p.name)}">${esc(term(p.name))}</a></td><td>${p.off === "Unknown" ? t("unknown") : num(p.off)}</td><td>${num(p.ext)}</td><td>${p.miss === "Unknown" ? t("unknown") : num(p.miss)}</td><td>${statusChip(p.status)}</td><td class="small">${en(p.notes)}</td></tr>`).join("")}
        </tbody></table></div>`,
    };
  }

  function viewData(F) {
    const s = F.meta.slug, d = F.meta.downloads || {};
    const year = new Date().getFullYear();
    return {
      title: t("data"),
      html: `${crumbs([[link(s), esc(term(F.meta.name))], [null, t("data")]])}<h1>${t("data")}</h1>
        <h2>${t("downloads")}</h2><div class="chips">${Object.entries(d).map(([k, href]) => `<a class="btn primary" href="${esc(href)}" download>⬇ ${t(k)} (.${k})</a>`).join("")}</div>
        <h2>${t("methodology")}</h2><ol class="content-en" lang="en" dir="ltr">${F.meta.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ol>
        <h2>${t("cite")}</h2><p class="card"><bdi>${esc(t("citeText", { name: term(F.meta.name), start: num(F.meta.start), end: num(F.meta.end), year: num(year) }))}</bdi></p>
        <p><a href="#/roadmap">${t("roadmap")}</a></p>`,
    };
  }

  async function viewWatchlist(m) {
    const items = [...state.watch];
    const slugs = [...new Set(items.map((k) => k.split(":")[0]))].filter((x) => m.festivals.some((f) => f.slug === x));
    const fests = await Promise.all(slugs.map(loadFest));
    const groups = fests.filter(Boolean).map((F) => [F, items.filter((k) => k.startsWith(F.meta.slug + ":")).map((k) => F.byId.get(k.split(":")[1])).filter(Boolean)]);
    return {
      title: t("watchlist"),
      html: `<h1>☆ ${t("watchlist")}</h1><p class="muted small">${t("watchNote")}</p>
        ${groups.some(([, l]) => l.length) ? groups.map(([F, list]) => `<h2>${esc(term(F.meta.name))} <button class="btn" data-csv="${esc(F.meta.slug)}">⬇ ${t("exportCsv")}</button></h2>
          <div class="film-list">${list.map((f) => filmCard(F, f, f.ap, false)).join("")}</div>`).join("") : `<p class="card">${t("emptyWatch")}</p>`}`,
      after() {
        $$("[data-csv]").forEach((b) => b.onclick = () => { const g = groups.find(([F]) => F.meta.slug === b.dataset.csv); filmsCsv(g[0], g[1], `watchlist_${b.dataset.csv}.csv`); });
      },
    };
  }

  function viewAbout(m) {
    return {
      title: t("about"),
      html: `<h1>${t("about")}</h1><p>${t("tagline")}</p>
        <div class="grid cols-2">${m.festivals.map((f) => `<section class="card"><h3>${esc(term(f.name))}</h3><p class="muted small">${num(f.start)}–${num(f.end)}</p>
          <a class="btn" href="${link(f.slug, "data")}">${t("data")}</a> <a class="btn" href="${link(f.slug, "quality")}">${t("quality")}</a></section>`).join("")}</div>
        <h2>${t("stillPlanned")}</h2><p><a href="#/roadmap">${t("roadmap")}</a></p>`,
    };
  }

  function viewCatalog(cat) {
    if (!cat) return { html: `<p>${t("notFound")}</p>` };
    const label = { published: t("statusPublished"), in_progress: t("statusInProgress"), planned: t("planned") };
    const cls = { published: "ok", in_progress: "warn", planned: "" };
    return {
      title: t("catalogTitle"),
      html: `<h1>${t("catalogTitle")}</h1><p class="muted">${t("catalogIntro")}</p>
        <div class="results-bar"><input id="cq" type="search" style="max-width:380px" placeholder="${esc(t("search"))}…" aria-label="${esc(t("search"))}">
        <span class="chips">${["", "published", "in_progress", "planned"].map((k) => `<button class="chip" type="button" data-st="${k}" aria-pressed="${k === ""}">${k ? label[k] : t("allFestivals")}</button>`).join("")}</span></div>
        <div class="table-wrap"><table><thead><tr><th>${t("festivals")}</th><th>${t("status")}</th><th>${t("source")}</th></tr></thead><tbody id="cbody"></tbody></table></div>`,
      after() {
        let st = "";
        const draw = () => {
          const q = fold($("#cq").value);
          const list = cat.festivals.filter((f) => (!st || f.status === st) && (!q || fold(f.name).includes(q)));
          $("#cbody").innerHTML = list.map((f) => `<tr><td>${f.slug ? `<a href="${link(f.slug)}">${bdi(term(f.name))}</a>` : bdi(term(f.name))}${f.note ? `<div class="small muted">${bdi(f.note)}</div>` : ""}</td>
            <td><span class="chip ${cls[f.status]}">${label[f.status]}</span></td>
            <td>${f.website ? `<a class="ltr small" href="${esc(f.website)}" target="_blank" rel="noopener">${esc(f.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : "—"}</td></tr>`).join("");
          announce(`${fmt(list.length)} ${t("festivals")}`);
        };
        $("#cq").oninput = draw;
        $$("[data-st]").forEach((b) => b.onclick = () => { st = b.dataset.st; $$("[data-st]").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); });
        draw();
      },
    };
  }

  async function viewSearch(m, params) {
    const q = params.get("q") || "";
    const fests = await Promise.all(m.festivals.map((f) => loadFest(f.slug)));
    const groups = fests.filter(Boolean).map((F) => [F, filterFilms(F, { q, sort: "awards" })]);
    const total = groups.reduce((n, [, l]) => n + l.length, 0);
    return {
      title: t("search"),
      html: `<h1>${t("search")}</h1>
        <form id="gs" role="search" style="max-width:640px"><label class="sr-only" for="gq">${t("search")}</label>
        <input id="gq" class="search-big" type="search" value="${esc(q)}" placeholder="${esc(t("searchPlaceholder"))}"></form>
        <p class="muted" style="margin-top:12px">${t("results", { n: fmt(total) })} · ${t("allFestivals")}</p>
        ${groups.map(([F, list]) => `<h2>${esc(term(F.meta.name))} <span class="muted small">(${fmt(list.length)})</span></h2>
          ${list.length ? `<div class="film-list">${list.slice(0, 12).map((f) => filmCard(F, f)).join("")}</div>
          ${list.length > 12 ? `<p><a class="btn" href="${withParams(link(F.meta.slug, "films"), { q })}">${t("loadMore")} (${fmt(list.length)})</a></p>` : ""}` : `<p class="muted">${t("noResults")}</p>`}`).join("")}`,
      after() {
        $("#gs").onsubmit = (e) => { e.preventDefault(); location.hash = withParams("#/search", { q: $("#gq").value.trim() }); };
        announce(t("results", { n: fmt(total) }));
      },
    };
  }

  async function viewRoadmap() {
    const md = await (await fetch("data/roadmap.txt")).text();
    const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
    const out = []; let table = null;
    for (const line of md.split("\n")) {
      if (/^\|/.test(line)) {
        const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (cells.every((c) => /^-+$/.test(c))) continue;
        if (!table) { table = [`<div class="table-wrap"><table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>`]; continue; }
        table.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`); continue;
      }
      if (table) { out.push(table.join("") + "</tbody></table></div>"); table = null; }
      const h = line.match(/^(#{1,3})\s+(.*)/);
      if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      else if (/^\d+\.\s/.test(line)) out.push(`<p style="margin:.2em 0">${inline(line)}</p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (table) out.push(table.join("") + "</tbody></table></div>");
    return { title: t("stillPlanned"), html: `<div class="content-en" lang="en" dir="ltr">${out.join("")}</div>` };
  }

  // ---------- global events ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".star[data-w]");
    if (!b) return;
    const k = b.dataset.w;
    state.watch.has(k) ? state.watch.delete(k) : state.watch.add(k);
    store.set("watchlist", [...state.watch]);
    $$(`.star[data-w="${CSS.escape(k)}"]`).forEach((el) => {
      const on = state.watch.has(k);
      el.setAttribute("aria-pressed", on); el.textContent = on ? "★" : "☆";
      el.title = on ? t("removeWatch") : t("addWatch");
    });
    announce(state.watch.has(k) ? t("addWatch") : t("removeWatch"));
    renderChrome(parseHash().parts);
  });
  $("#lang-btn").onclick = () => {
    state.lang = state.lang === "fa" ? "en" : "fa";
    try { localStorage.setItem("lang", state.lang); } catch (e) {}
    document.documentElement.lang = state.lang; document.documentElement.dir = state.lang === "fa" ? "rtl" : "ltr";
    state.lastPath = null; route();
  };
  $("#theme-btn").onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    renderChrome(parseHash().parts);
  };
  $("#menu-btn").onclick = () => { const o = $("#nav").classList.toggle("open"); $("#menu-btn").setAttribute("aria-expanded", o); };
  $("#nav").addEventListener("click", (e) => { if (e.target.closest("a")) { $("#nav").classList.remove("open"); $("#menu-btn").setAttribute("aria-expanded", "false"); } });
  window.addEventListener("hashchange", route);
  route();
})();
