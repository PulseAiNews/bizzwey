export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const PB_URL = env.PB_URL;
  const PB_TOKEN = env.PB_TOKEN;

  if (!PB_URL) {
    return new Response("PB_URL missing", { status: 500 });
  }

  const pbRes = await fetch(
    `${PB_URL}/api/collections/publish_ready/records/${encodeURIComponent(id)}`,
    {
      headers: PB_TOKEN
        ? { Authorization: `Bearer ${PB_TOKEN}` }
        : {},
    }
  );

  if (!pbRes.ok) {
    const txt = await pbRes.text();
    return new Response(`PB error ${pbRes.status}: ${txt}`, { status: 502 });
  }

  const post = await pbRes.json();

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="robots" content="noindex,nofollow"/>
  <title>${escape(post.title)}</title>
  <style>
    body{font-family:system-ui;background:#0e0e11;color:#eaeaf0;margin:0}
    .wrap{max-width:820px;margin:auto;padding:32px}
    h1{font-size:32px}
    .summary{opacity:.9;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escape(post.title)}</h1>
    <p class="summary">${escape(post.summary || "")}</p>
    ${render(post.body || "")}
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escape(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function render(text) {
  return text
    .split(/\n\s*\n/g)
    .map(p => `<p>${escape(p)}</p>`)
    .join("\n");
}
