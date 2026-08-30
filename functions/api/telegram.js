async function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "GET") {
    return json({
      ok: true,
      platform: "cloudflare-pages",
      hasBot: Boolean(env.BOT_TOKEN),
      hasGh: Boolean(env.GH_TOKEN),
      owner: env.GH_OWNER || null,
      repo: env.GH_REPO || null
    });
  }
  if (request.method !== "POST") return json({ ok: false }, 405);
  let update = {};
  try { update = await request.json(); } catch (_) {}
  try {
    await handleUpdate(update, env);
  } catch (e) {
    const msg = update.message || update.channel_post;
    if (msg && env.BOT_TOKEN) await reply(env, msg.chat.id, "Error: " + String(e.message || e));
  }
  return json({ ok: true });
}

async function handleUpdate(update, env) {
  const msg = update.message || update.channel_post;
  if (!msg || !msg.text) return;
  const text = String(msg.text).trim();
  const chatId = msg.chat.id;
  if (!env.BOT_TOKEN) return;
  const allowed = String(env.TELEGRAM_USER_ID || "7747474006").trim();
  const fromId = String((msg.from && msg.from.id) || "");
  if (allowed && fromId && fromId !== allowed && String(chatId) !== allowed) {
    await reply(env, chatId, "Akses ditolak.\nBot ini hanya untuk admin.");
    return;
  }
  if (text.startsWith("/start") || text.startsWith("/help")) {
    await reply(env, chatId, "Bot upload Dr. Pinguin aktif.\\nKirim link videy.co / vicek.id / indoav / userbokep.");
    return;
  }
  const links = extractLinks(text);
  if (!links.length) {
    await reply(env, chatId, "Tidak ada link yang dikenali.");
    return;
  }
  if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO) {
    await reply(env, chatId, "Env GitHub belum lengkap di Cloudflare Pages.");
    return;
  }
  const items = links.map(toItem);
  const repos = [env.GH_REPO, env.GH_REPO_2].filter(Boolean);
  const results = [];
  for (const repo of repos) {
    const r = await mergeAndPush(env, repo, items);
    results.push(repo + ": +" + r.added + " skip " + r.skipped);
  }
  await reply(env, chatId, "Selesai diproses.\\nLink: " + items.length + "\\n" + results.join("\\n"));
}

function extractLinks(text) {
  const re = /https?:\/\/[^\s<>"']+/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const u = m[0].replace(/[.,);]+$/, "");
    if (/videy\.co|vicek\.id|indoav\.|userbokep\.|playmogo\./i.test(u)) out.push(u);
  }
  return out;
}
function toItem(url) {
  const u = url.trim();
  let category = "Umum";
  if (/videy\.co/i.test(u)) category = "Videy";
  else if (/vicek\.id|exastream/i.test(u)) category = "ExaStream";
  else if (/playmogo|dood/i.test(u)) category = "AI Bokep";
  const id = u.split("/").pop().split("?").pop().replace(/^id=/, "") || "video";
  return {
    title: category + " " + id + " - koleksidrpinguin.com",
    direct: u, embed: u, source: category, category: category,
    tags: [category.toLowerCase()], date: new Date().toISOString().slice(0, 10)
  };
}
function videoKey(v) {
  return String(v.embed || v.direct || "").toLowerCase().replace(/\/+$/, "");
}
async function mergeAndPush(env, repo, items) {
  const owner = env.GH_OWNER;
  const path = env.GH_PATH || "data/videos.json";
  const branch = env.GH_BRANCH || "main";
  const meta = await gh(env, "/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch);
  let raw = "";
  if (meta.content) raw = atob(meta.content.replace(/\n/g, ""));
  else {
    const dl = meta.download_url;
    const rr = await fetch(dl + "?t=" + Date.now(), { headers: { Authorization: "token " + env.GH_TOKEN, "User-Agent": "dr-pinguin-tg-bot" } });
    raw = await rr.text();
  }
  const videos = JSON.parse(raw);
  const exist = new Set(videos.map(videoKey));
  let added = 0, skipped = 0;
  const fresh = [];
  for (const it of items) {
    const k = videoKey(it);
    if (exist.has(k)) { skipped += 1; continue; }
    exist.add(k); fresh.push(it); added += 1;
  }
  for (let i = fresh.length - 1; i >= 0; i--) videos.unshift(fresh[i]);
  if (!added) return { added, skipped };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(videos, null, 2))));
  await gh(env, "/repos/" + owner + "/" + repo + "/contents/" + path, {
    method: "PUT",
    body: JSON.stringify({ message: "bot: add " + added + " videos from Telegram", content, sha: meta.sha, branch })
  });
  return { added, skipped };
}
async function gh(env, path, opt) {
  opt = opt || {};
  const res = await fetch("https://api.github.com" + path, {
    method: opt.method || "GET",
    headers: {
      Authorization: "token " + env.GH_TOKEN,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "dr-pinguin-tg-bot",
      "Content-Type": "application/json"
    },
    body: opt.body
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || String(res.status));
  return data;
}
async function reply(env, chatId, text) {
  await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
