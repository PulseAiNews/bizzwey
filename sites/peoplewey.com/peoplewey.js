const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const state = { feed: [], countries: [] };

function esc(s="") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

async function loadJSON(url, fallback) {
  try {
    const r = await fetch(url, {cache:"no-store"});
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return fallback;
  }
}

function storyCard(item, i) {
  const href = item.url || "#";
  const ext = href.startsWith("http");
  return `
    <article class="story-card">
      <a href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ""}>
        <div class="card-art"><span>${esc(item.category || "People")}</span></div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.source || "PeopleWey")} · ${esc(item.country || "WORLD")}</p>
      </a>
    </article>`;
}function sideStory(item, i) {
  const initial = (item.category || "P").slice(0,1).toUpperCase();
  const ext = (item.url || "").startsWith("http");
  return `
    <article class="side-story">
      <div class="story-art">${initial}</div>
      <div class="side-copy">
        <span class="meta">${esc(item.category || "People")} · ${esc(item.country || "WORLD")}</span>
        <h3><a href="${esc(item.url || "#")}" ${ext ? 'target="_blank" rel="noopener"' : ""}>${esc(item.title)}</a></h3>
        <p class="source">${esc(item.source || "PeopleWey")}</p>
      </div>
    </article>`;
}

function renderFeed(items) {
  const hero = $("#heroSide");
  const latest = $("#latestGrid");
  if (hero) hero.innerHTML = items.slice(0,3).map(sideStory).join("");
  if (latest) latest.innerHTML = items.slice(0,12).map(storyCard).join("");
  renderTrending(items);
}

function renderTrending(items) {
  const base = ["Princess Diana","The Traitors","Mark Ruffalo","Reacher","SNL UK","Awards","K-pop","Bollywood"];
  const found = [];
  for (const item of items) {
    for (const tag of base) if (item.title?.toLowerCase().includes(tag.toLowerCase())) found.push(tag);
  }
  const tags = [...new Set([...found, ...base])].slice(0,8);
  $("#trendingRow").innerHTML = tags.map(t => `<button class="trend-pill" data-search="${esc(t)}"># ${esc(t)}</button>`).join("");
}function renderCountries(filter="") {
  const q = filter.trim().toLowerCase();
  const items = state.countries.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  );
  $("#countryGrid").innerHTML = items.map(c =>
    `<button data-select-country="${c.code}"><strong>${esc(c.name)}</strong><small>${c.code}</small></button>`
  ).join("");
}

function openWorld() {
  renderCountries($("#countrySearch")?.value || "");
  $("#worldDialog").showModal();
  setTimeout(() => $("#countrySearch")?.focus(), 30);
}

function selectCountry(code) {
  const c = state.countries.find(x => x.code === code);
  $("#worldDialog").close();
  const matching = state.feed.filter(x => x.country === code || x.country === "GLOBAL");
  const name = c?.name || code;
  if (matching.length) {
    renderFeed(matching);
    $("#latest").scrollIntoView({behavior:"smooth"});
  } else {
    renderFeed(state.feed);
    const world = $("#world");
    world.scrollIntoView({behavior:"smooth"});
    const stat = world.querySelector(".world-stat span");
    if (stat) stat.textContent = `${name} is in the PeopleWey world radar — local showbiz feed coming through the country pipeline.`;
  }
}function doSearch(term) {
  const q = term.trim().toLowerCase();
  const box = $("#searchResults");
  if (!q) { box.innerHTML = ""; return; }
  const stories = state.feed.filter(x =>
    [x.title,x.source,x.category,x.country].some(v => String(v||"").toLowerCase().includes(q))
  );
  const countries = state.countries.filter(x =>
    x.name.toLowerCase().includes(q) || x.code.toLowerCase() === q
  ).slice(0,6);
  const parts = [];
  for (const x of stories.slice(0,8)) {
    parts.push(`<a class="search-result" href="${esc(x.url||"#")}" ${(x.url||"").startsWith("http")?'target="_blank" rel="noopener"':""}><strong>${esc(x.title)}</strong><span>${esc(x.source)} · ${esc(x.country)}</span></a>`);
  }
  for (const c of countries) {
    parts.push(`<button class="search-result" data-select-country="${c.code}"><strong>${esc(c.name)}</strong><span>PeopleWey World · ${c.code}</span></button>`);
  }
  box.innerHTML = parts.length ? parts.join("") : '<p class="search-result"><strong>No matching live item yet.</strong><span>Try a country, person or category.</span></p>';
}

function bindUI() {
  $("#menuBtn")?.addEventListener("click", () => $("#primaryNav").classList.toggle("open"));
  $$("[data-open-world]").forEach(b => b.addEventListener("click", openWorld));
  $("#closeWorld")?.addEventListener("click", () => $("#worldDialog").close());
  $("#countrySearch")?.addEventListener("input", e => renderCountries(e.target.value));
  $("#searchForm")?.addEventListener("submit", e => { e.preventDefault(); doSearch($("#searchInput").value); });
  $("#searchInput")?.addEventListener("input", e => doSearch(e.target.value));
}document.addEventListener("click", e => {
  const country = e.target.closest("[data-select-country]");
  if (country) selectCountry(country.dataset.selectCountry);
  const quick = e.target.closest("[data-country]");
  if (quick) selectCountry(quick.dataset.country);
  const search = e.target.closest("[data-search]");
  if (search) {
    $("#searchInput").value = search.dataset.search;
    doSearch(search.dataset.search);
    $("#search").scrollIntoView({behavior:"smooth"});
  }
});

async function init() {
  const [feed, countries] = await Promise.all([
    loadJSON("/peoplewey-feed.json", {items:[]}),
    loadJSON("/peoplewey-countries.json", {items:[]})
  ]);
  state.feed = feed.items || [];
  state.countries = countries.items || [];
  renderFeed(state.feed);
  renderCountries();
  bindUI();
}

init();
