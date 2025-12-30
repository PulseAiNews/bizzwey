export async function onRequestGet({ env, request }) {
  const PB_URL = env.PB_URL || "https://api.newswey.com";

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const r = await fetch(
    `${PB_URL}/api/collections/publish_ready/records/${encodeURIComponent(id)}`,
    { headers: { accept: "application/json" } }
  );

  if (!r.ok) {
    return new Response(
      JSON.stringify({ error: "PocketBase error", status: r.status }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const data = await r.json();
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
