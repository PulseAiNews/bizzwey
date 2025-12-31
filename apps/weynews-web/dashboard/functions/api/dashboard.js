// functions/api/dashboard.js
export async function onRequestGet(context) {
  const PB_URL = context.env.PB_URL;         // ex: https://api.newswey.com
  const PB_TOKEN = context.env.PB_TOKEN;     // token read-only PocketBase
  const BRAND_FIELD = context.env.BRAND_FIELD || "vertical";
  const EVENT_BRAND_FIELD = context.env.EVENT_BRAND_FIELD || "vertical";

  const headers = {
    "Authorization": `Bearer ${PB_TOKEN}`,
    "Content-Type": "application/json",
  };

  function pbDateTime(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function todayRange() {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return { s: pbDateTime(s), e: pbDateTime(e) };
  }

  async function pbFetch(collection, qs) {
    const url = `${PB_URL}/api/collections/${collection}/records?${qs}`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`PB ${collection} ${r.status} ${r.statusText} :: ${t.slice(0, 400)}`);
    }
    return r.json();
  }

  async function pbFirst(collection, sortField) {
    return pbFetch(collection, `sort=-${sortField}&perPage=1`);
  }

  function groupCount(items, field) {
    const map = {};
    for (const it of items || []) {
      const k = it?.[field] ?? "UNKNOWN";
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }

  try {
    const { s, e } = todayRange();
    const todayFilter = (field) => `filter=(${field}>="${s}" && ${field}<="${e}")`;

    // --- HEALTH (dernier record par WF)
    const workflows = [
      { name: "Ingestion", collection: "news_raw", field: "created" },
      { name: "Tri", collection: "directed_items", field: "sr_processed_at" },
      { name: "Events", collection: "news_canonical", field: "event_updated_at" },
      { name: "IA", collection: "publish_ready", field: "created" },
      { name: "Publication", collection: "published_posts", field: "published_at" },
    ];

    const health = [];
    for (const wf of workflows) {
      const data = await pbFirst(wf.collection, wf.field);
      const last = data?.items?.[0]?.[wf.field] || null;
      health.push({ ...wf, last });
    }

    // --- WF1 ingestion today
    const rawToday = await pbFetch("news_raw", `${todayFilter("created")}&perPage=500`);
    const rawItems = rawToday.items || [];
    const itemsToday = rawToday.totalItems ?? rawItems.length;
    const activeSources = [...new Set(rawItems.map(x => x.source_name).filter(Boolean))].length;
    const latestRaw = rawItems.reduce((a, b) => (new Date(a.created) > new Date(b.created) ? a : b), rawItems[0] || null);

    // --- WF2 tri today
    const diToday = await pbFetch("directed_items", `${todayFilter("sr_processed_at")}&perPage=500`);
    const diItems = diToday.items || [];
    const accepted = diItems.filter(x => x.sr_reject === false).length;
    const rejected = diItems.filter(x => x.sr_reject === true).length;
    const urgent = diItems.filter(x => x.sr_priority === "URGENT").length;
    const spam = diItems.filter(x => x.spam_detected === true).length;

    // --- WF3 events
    const canonical = await pbFetch("news_canonical", `perPage=500&sort=-event_updated_at`);
    const canItems = canonical.items || [];
    const statuses = ["NEW", "ACTIVE", "WATCH", "DORMANT", "ARCHIVED"];
    const statusCounts = Object.fromEntries(statuses.map(s => [s, canItems.filter(x => x.event_status === s).length]));

    const obsSum = canItems.reduce((acc, x) => acc + (Number(x.raw_count) || 0), 0);

    const todayEvents = await pbFetch("news_canonical", `${todayFilter("event_updated_at")}&perPage=500`);
    const eventsByWey = groupCount(todayEvents.items || [], EVENT_BRAND_FIELD);

    // --- WF4 IA
    const ready = await pbFetch("publish_ready", `perPage=500&sort=-created`);
    const readyItems = ready.items || [];
    const iaPending = readyItems.filter(x => !x.ia_processed_at).length;

    const readyToday = await pbFetch("publish_ready", `${todayFilter("created")}&perPage=500`);
    const genCount = readyToday.totalItems ?? (readyToday.items?.length || 0);

    const neutralOk = readyItems.filter(x => {
      try { return JSON.parse(x.neutrality_check || "{}")?.is_neutral === true; }
      catch { return false; }
    }).length;

    const tokensSum = (readyToday.items || []).reduce((a, x) => {
      try { return a + (Number(JSON.parse(x.generation_audit || "{}")?.tokens) || 0); }
      catch { return a; }
    }, 0);

    // --- WF5 publication today
    const pubToday = await pbFetch("published_posts", `${todayFilter("published_at")}&perPage=500`);
    const pubItems = pubToday.items || [];
    const publishedToday = pubToday.totalItems ?? pubItems.length;
    const publishedByWey = groupCount(pubItems, BRAND_FIELD);

    // --- LATENCY (approx)
    const lastRaw = await pbFirst("news_raw", "created");
    const lastPub = await pbFirst("published_posts", "published_at");
    let latencyMin = null;
    if (lastRaw?.items?.length && lastPub?.items?.length) {
      const a = new Date(lastRaw.items[0].created);
      const b = new Date(lastPub.items[0].published_at);
      latencyMin = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
    }

    // --- DUPLICATES
    const dupField = context.env.DUP_FIELD || "source_url";
    let duplicates = { field: dupField, total: 0, unique: 0, dup: 0 };
    if (pubItems.length) {
      const vals = pubItems.map(x => x?.[dupField]).filter(Boolean);
      const uniq = new Set(vals);
      duplicates = { field: dupField, total: vals.length, unique: uniq.size, dup: Math.max(0, vals.length - uniq.size) };
    }

    const payload = {
      ts: new Date().toISOString(),
      health,
      latencyMin,
      costs: {
        tokensToday: tokensSum,
        costUsdToday: Number((tokensSum * 0.000008).toFixed(4)),
      },
      wf1: { itemsToday, activeSources, lastRawCreated: latestRaw?.created || null },
      wf2: { accepted, rejected, urgent, spam },
      wf3: { statusCounts, obsSum, eventsByWey },
      wf4: { generatedToday: genCount, neutralityRate: readyItems.length ? Math.round((neutralOk / readyItems.length) * 100) : null, iaPending },
      wf5: { publishedToday, publishedByWey },
      duplicates,
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=15",
        "X-Robots-Tag": "noindex, nofollow"
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow"
      },
    });
  }
}
