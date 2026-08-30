export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, s-maxage=60"
  };
  if (request.method === "OPTIONS") return new Response(null, { headers });
  try {
    const origin = url.origin;
    const res = await fetch(origin + "/data/videos.json", { cf: { cacheTtl: 60 } });
    const raw = await res.json();
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const cat = (url.searchParams.get("cat") || "").toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
    let list = raw.map((v) => ({
      id: String(v.id || v.embed || v.direct || "").slice(-16),
      title: v.title || "",
      category: v.category || "Umum",
      embed: v.embed || v.embedUrl || "",
      direct: v.direct || "",
      date: v.date || "",
      source: v.source || ""
    }));
    if (cat) list = list.filter((v) => (v.category || "").toLowerCase() === cat);
    if (q) list = list.filter((v) => (v.title + " " + v.category).toLowerCase().includes(q));
    const total = list.length;
    const start = (page - 1) * limit;
    return new Response(JSON.stringify({ ok: true, total, page, limit, items: list.slice(start, start + limit) }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), { status: 500, headers });
  }
}
