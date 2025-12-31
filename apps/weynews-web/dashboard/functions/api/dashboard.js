// apps/weynews-web/dashboard/functions/api/dashboard.js
// Cloudflare Pages Function: GET /api/dashboard
// Aggregates PocketBase metrics for WF1→WF5 + per-vertical counts.
// Robust auth handling: tries without auth first, retries with Bearer only if PB_TOKEN looks like a JWT.

export async function onRequest(context) {
  const { request, env } = context;

  // CORS (optional, but handy if you ever call it from other origins)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  try {
    const PB_URL = (env.PB_URL || "").replace(/\/+$/, "");
    const PB_TOKEN = env.PB_TOKEN || "";
    const BRAND_FIELD = env.BRAND_FIELD || "vertical";
    const EVENT_BRAND_FIELD = env.EVENT_BRAND_FIELD || "vertical";
    const DUP_FIELD = env.DUP_FIELD || "source_url";

    if (!PB_URL) {
      return json(
        { ok: false, error: "PB_URL missing in Pages env vars (Production/Preview scope?)" },
        500,
        request
      );
    }

    // -------------------------
    // Helper: PocketBase fetcher
    // -------------------------
    async function pbFetch(collection, query) {
      const base = `${PB_URL}/api/collections/${collection}/records?${query}`;

      // 1) Try WITHOUT auth first (works if collection is public read)
      let r = await fetch(base, { headers: { "Content-Type": "application/json" } });

      // 2) If unauthorized AND we have a JWT token, retry with Bearer
      if (r.status === 401 && PB_TOKEN && PB_TOKEN.includes(".")) {
        r = await fetch(base, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PB_TOKEN}`,
          },
        });
      }

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`PB ${collection} ${r.status} ${r.statusText} :: ${t.slice(0, 800)}`);
      }
      return r.json();
    }

    async function pbGetOne(collection, id) {
      const url = `${PB_URL}/api/collections/${collection}/records/${encodeURIComponent(id)}`;

      // Try without auth
      let r = await fetch(url, { headers: { "Content-Type": "application/json" } });

      // Retry with Bearer if looks like JWT
      if (r.status === 401 && PB_TOKEN && PB_TOKEN.includes(".")) {
        r = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PB_TOKEN}`,
          },
        });
      }

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`PB ${collection}/${id} ${r.status} ${r.statusText} :: ${t.slice(0, 800)}`);
      }
      return r.json();
    }

    // -------------------------
    // Utility helpers
    // -------------------------
    const now = new Date();
    const utc0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const isoDayStart = utc0.toISOString(); // YYYY-MM-DDT00:00:00.000Z

    // PocketBase filter uses field names; we try to use created/updated when present.
    const pbFilter = (s) => s.replaceAll('"', '\\"'); // minimal escaping for PB filter string

    const qs = (obj) =>
      Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");

    // -------------------------
    // Fetch last items (fast)
    // -------------------------
    // If one collection name differs in your PB, change it here.
    const COL = {
      news_raw: "news_raw",
      directed_items: "directed_items",
      publish_ready: "publish_ready",
      published_posts: "published_posts",
    };

    // Minimal "last record" pulls
    const [lastRaw, lastDirected, lastReady, lastPublished] = await Promise.all([
      pbFetch(COL.news_raw, qs({ sort: "-created", perPage: 1 })),
      pbFetch(COL.directed_items, qs({ sort: "-updated", perPage: 1 })),
      pbFetch(COL.publish_ready, qs({ sort: "-updated", perPage: 1 })),
      pbFetch(COL.published_posts, qs({ sort: "-created", perPage: 1 })),
    ]);

    // -------------------------
    // Counts today (approx)
    // -------------------------
    // created >= today 00:00 UTC
    // Note: if you want Dubai-day, we can change to +04:00 boundaries later.
    const [rawToday, readyToday, publishedToday] = await Promise.all([
      pbFetch(
        COL.news_raw,
        qs({
          perPage: 1,
          filter: pbFilter(`created >= "${isoDayStart}"`),
        })
      ),
      pbFetch(
        COL.publish_ready,
        qs({
          perPage: 1,
          filter: pbFilter(`created >= "${isoDayStart}" && ready_to_publish = true`),
        })
      ),
      pbFetch(
        COL.published_posts,
        qs({
          perPage: 1,
          filter: pbFilter(`created >= "${isoDayStart}"`),
        })
      ),
    ]);

    // -------------------------
    // Breakdown by vertical (optional but useful)
    // We do it on publish_ready because that's the content layer.
    // -------------------------
    const verticals = ["news", "expat", "dias", "sport", "business", "finance", "tech"];
    const readyByVertical = {};

    await Promise.all(
      verticals.map(async (v) => {
        try {
          const r = await pbFetch(
            COL.publish_ready,
            qs({
              perPage: 1,
              filter: pbFilter(`created >= "${isoDayStart}" && ${BRAND_FIELD} = "${v}" && ready_to_publish = true`),
            })
          );
          readyByVertical[v] = r?.totalItems ?? 0;
        } catch {
          // If field doesn't exist, don't kill dashboard
          readyByVertical[v] = null;
        }
      })
    );

    // -------------------------
    // Duplicate / loop detection (quick signals)
    // Example: if same publish_ready_id shows multiple times in last 100 published_posts
    // -------------------------
    let loopSignals = { duplicatePublishReadyIdsInRecent: 0 };
    try {
      const recentPublished = await pbFetch(COL.published_posts, qs({ sort: "-created", perPage: 100 }));
      const ids = (recentPublished.items || []).map((x) => x.publish_ready_id).filter(Boolean);
      const seen = new Set();
      let dup = 0;
      for (const id of ids) {
        if (seen.has(id)) dup++;
        else seen.add(id);
      }
      loopSignals.duplicatePublishReadyIdsInRecent = dup;
    } catch {
      // ignore
    }

    // -------------------------
    // Response JSON for frontend
    // -------------------------
    const payload = {
      ok: true,
      meta: {
        generated_at: new Date().toISOString(),
        day_start_utc: isoDayStart,
        pb_url: PB_URL,
      },
      env: {
        BRAND_FIELD,
        EVENT_BRAND_FIELD,
        DUP_FIELD,
        token_mode: PB_TOKEN
          ? PB_TOKEN.includes(".")
            ? "bearer-jwt"
            : "no-bearer-nonjwt"
          : "none",
      },
      wf: {
        wf1_ingestion: {
          total_items: lastRaw.totalItems ?? null,
          last_item: (lastRaw.items && lastRaw.items[0]) ? pick(lastRaw.items[0], ["id", "created", "updated", "title", "source_domain", "provider", "language"]) : null,
          today_count: rawToday.totalItems ?? null,
        },
        wf3_event_engine: {
          // directed_items usually represents “post-routing” items
          total_items: lastDirected.totalItems ?? null,
          last_item: (lastDirected.items && lastDirected.items[0]) ? pick(lastDirected.items[0], ["id", "updated", "created", "event_id", "ee_processed", "directed", BRAND_FIELD, EVENT_BRAND_FIELD]) : null,
        },
        wf4_generation: {
          total_items: lastReady.totalItems ?? null,
          last_item: (lastReady.items && lastReady.items[0]) ? pick(lastReady.items[0], ["id", "updated", "created", "event_id", "title", "ready_to_publish", BRAND_FIELD]) : null,
          today_ready_to_publish: readyToday.totalItems ?? null,
          today_ready_by_vertical: readyByVertical,
        },
        wf5_publication: {
          total_items: lastPublished.totalItems ?? null,
          last_item: (lastPublished.items && lastPublished.items[0]) ? pick(lastPublished.items[0], ["id", "created", "updated", "platform", "publish_ready_id", "published_url", "published_at", "event_id"]) : null,
          today_published: publishedToday.totalItems ?? null,
        },
      },
      signals: loopSignals,
    };

    // Cache 15s at edge to reduce PB load
    const headers = {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=15",
    };

    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (err) {
    return json(
      {
        ok: false,
        error: String(err?.message || err),
      },
      500,
      context.request
    );
  }
}

// -------------------------
// Helpers
// -------------------------
function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function json(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function corsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
