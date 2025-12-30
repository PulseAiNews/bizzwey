export async function onRequestGet({ env }) {
  const PB_URL = env.PB_URL || "https://api.newswey.com";

  const url =
    PB_URL +
    "/api/collections/publish_ready/records" +
    "?sort=-created&perPage=10&filter=(ready_to_publish=true)";

  const r = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!r.ok) {
    return new Response(
      JSON.stringify({ error: "PocketBase error", status: r.status }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const data = await r.json();

  return new Response(JSON.stringify(data.items || []), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=15",
    },
  });
}
