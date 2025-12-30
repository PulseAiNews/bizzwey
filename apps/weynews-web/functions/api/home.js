export async function onRequestGet() {
  return new Response(
    JSON.stringify({ ok: true, api: "pages-functions" }),
    { headers: { "content-type": "application/json" } }
  );
}
