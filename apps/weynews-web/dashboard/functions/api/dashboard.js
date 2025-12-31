// apps/weynews-web/dashboard/functions/api/dashboard.js
// GET /api/dashboard
// Works WITHOUT PB_TOKEN. Never sends Authorization.
// Hardens errors so one broken collection doesn't kill the whole dashboard.

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const PB_URL = (env.PB_URL || "").replace(/\/+$/, "");
  const BRAND_FIELD = env.BRAND_FIELD || "vertical";

  if (!PB_URL) {
    return json(
      { ok: false, error: "PB_URL missing in Cloudflare Pages env vars (Production/Preview)" },
      500,
      request
    );
  }

  // -------------------------
  // Small helpers
  // -------------------------
  const now = new Date();
  const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const isoDayStart = dayStartUtc.toISOString(); // YYYY-MM-DDT00:00:00.000Z

  const qs = (obj) =>
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");

  async function pbFetch(collection, query) {
    const url = `${PB_URL}/api/collections/${collection}/records?${query}`;

    const r = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    // Return structured error without throwing, so dashboard still works
    if (!r.ok) {
      const t = await r.text();
      return {
        __ok: false,
        __status: r.status,
        __statusText: r.statusText,
        __url: url,
        __body: t.slice(0, 600),
      };
    }

    const j = await r.json();
    return { __ok: true, __url: url, ...j };
  }

  function pick(obj, keys) {
    const out = {};
    for (const k of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    return out;
  }

  function asLastItem(res, keys) {
    if (!res || !res.__ok) return null;
    const it = res.items && res.items[0] ? res.items[0] : null;
    return it ? pick(it, keys) : null;
  }

  // -------------------------
  // Collections (change here only if names differ)
  // -------------------------
  const COL = {
    news_raw: "news_raw",
    directed_items: "directed_items",
    publish_ready: "publish_ready",
    published_posts: "published_posts",
  };

  // -------------------------
  // Fetch minimal stats (parallel)
  // -------------------------
  const [
    lastRaw,
    lastDirected,
    lastReady,
    lastPublished,
    rawToday,
    readyToday,
    publishedToday,
    recentPublished100,
  ] = await Promise.all([
    pbFetch(COL.news_raw, qs({ sort: "-created", perPage: 1 })),
    pbFetch(COL.directed_items, qs({ sort: "-updated", perPage: 1 })),
    pbFetch(COL.publish_ready, qs({ sort: "-updated", perPage: 1 })),
    pbFetch(COL.published_posts, qs({ sort: "-created", perPage: 1 })),

    pbFetch(COL.news_raw, qs({ perPage: 1, filter: `created >= "${isoDayStart}"` })),
    pbFetch(COL.publish_ready, qs({ perPage: 1, filter: `created >= "${isoDayStart}" && ready_to_publish = true` })),
    pbFetch(COL.published_posts, qs({ perPage: 1, filter: `created >= "${isoDayStart}"` })),

    pbFetch(COL.published_posts, qs({ sort: "-created", perPage: 100 })),
  ]);

  // -------------------------
  // Loop signal: duplicates in last 100 published_posts
  // -------------------------
  let dupCount = null;
  if (recentPublished100 && recentPublished100.__ok) {
    const ids = (recentPublished100.items || []).map((x) => x.publish_ready_id).filter(Boolean);
    const seen = new Set();
    let d = 0;
    for (const id of ids) {
      if (seen.has(id)) d++;
      else seen.add(id);
    }
    dupCount = d;
  }

  // -------------------------
  // Ready-to-publish by vertical (best-effort)
  // If the vertical field doesn't exist, you'll see nulls.
  // -------------------------
  const verticals = ["news", "expat", "dias", "sport", "business", "finance", "tech"];
  const readyByVertical = {};
  await Promise.all(
    verticals.map(async (v) => {
      const r = await pbFetch(
        COL.publish_ready,
        qs({
          perPage: 1,
          filter: `created >= "${isoDayStart}" && ${BRAND_FIELD} = "${v}" && ready_to_publish = true`,
        })
      );
      readyByVertical[v] = r.__ok ? (r.totalItems ?? 0) : null;
    })
  );

  // -------------------------
  // Compose payload
  // -------------------------
  const payload = {
    ok: true,
    meta: {
      generated_at: new Date().toISOString(),
      day_start_utc: isoDayStart,
      pb_url: PB_URL,
      auth: "none",
    },
    wf: {
      wf1_ingestion: {
        collection: COL.news_raw,
        total_items: lastRaw.__ok ? lastRaw.totalItems ?? null : null,
        today_count: rawToday.__ok ? rawToday.totalItems ?? null : null,
        last_item: asLastItem(lastRaw, ["id", "created", "updated", "title", "source_domain", "provider", "language", "url"]),
        error: lastRaw.__ok ? null : pick(lastRaw, ["__status", "__statusText", "__url", "__body"]),
      },
      wf3_event_engine: {
        collection: COL.directed_items,
        total_items: lastDirected.__ok ? lastDirected.totalItems ?? null : null,
        last_item: asLastItem(lastDirected, ["id", "created", "updated", "event_id", "ee_processed", "directed"]),
        error: lastDirected.__ok ? null : pick(lastDirected, ["__status", "__statusText", "__url", "__body"]),
      },
      wf4_generation: {
        collection: COL.publish_ready,
        total_items: lastReady.__ok ? lastReady.totalItems ?? null : null,
        today_ready_to_publish: readyToday.__ok ? readyToday.totalItems ?? null : null,
        today_ready_by_vertical: readyByVertical,
        last_item: asLastItem(lastReady, ["id", "created", "updated", "event_id", "title", "ready_to_publish", BRAND_FIELD]),
        error: lastReady.__ok ? null : pick(lastReady, ["__status", "__statusText", "__url", "__body"]),
      },
      wf5_publication: {
        collection: COL.published_posts,
        total_items: lastPublished.__ok ? lastPublished.totalItems ?? null : null,
        today_published: publishedToday.__ok ? publishedToday.totalItems ?? null : null,
        last_item: asLastItem(lastPublished, ["id", "created", "updated", "platform", "publish_ready_id", "published_url", "published_at", "event_id"]),
        error: lastPublished.__ok ? null : pick(lastPublished, ["__status", "__statusText", "__url", "__body"]),
      },
    },
    signals: {
      duplicatePublishReadyIdsInRecent100: dupCount,
    },
  };

  return json(payload, 200, request);
}

// -------------------------
// Response helpers
// -------------------------
function json(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=15",
    },
  });
}

function corsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
