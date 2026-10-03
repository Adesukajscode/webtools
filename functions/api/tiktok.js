// ─────────────────────────────────────────────
// TikTok Downloader — Cloudflare Pages Function
// Multi-provider fallback untuk reliability
// ─────────────────────────────────────────────

const UA = "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

async function tryTikWM(url, hd) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd}`;
  const r = await fetch(apiUrl, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`tikwm HTTP ${r.status}`);
  const d = await r.json();
  if (d.code !== 0 || !d.data) throw new Error(d.msg || "tikwm returned empty");
  const v = d.data;
  return {
    provider: "tikwm",
    id: v.id || "",
    title: v.title || "",
    author: {
      id: (v.author && v.author.unique_id) || "",
      nickname: (v.author && v.author.nickname) || "",
      avatar: (v.author && v.author.avatar) || ""
    },
    stats: {
      plays: v.play_count || 0,
      likes: v.digg_count || 0,
      comments: v.comment_count || 0,
      shares: v.share_count || 0
    },
    duration: v.duration || 0,
    cover: v.cover || "",
    video: {
      no_watermark: v.play || "",
      watermark: v.wmplay || "",
      hd: v.hdplay || ""
    },
    audio: {
      url: v.music || "",
      title: (v.music_info && v.music_info.title) || "",
      author: (v.music_info && v.music_info.author) || ""
    }
  };
}

async function tryTiklydown(url) {
  const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`;
  const r = await fetch(apiUrl, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`tiklydown HTTP ${r.status}`);
  const d = await r.json();
  if (!d || !d.video) throw new Error("tiklydown returned empty");

  return {
    provider: "tiklydown",
    id: d.id || "",
    title: d.title || "",
    author: {
      id: (d.author && d.author.unique_id) || "",
      nickname: (d.author && d.author.nickname) || "",
      avatar: (d.author && d.author.avatar) || ""
    },
    stats: {
      plays: d.stats && d.stats.playCount || 0,
      likes: d.stats && d.stats.diggCount || 0,
      comments: d.stats && d.stats.commentCount || 0,
      shares: d.stats && d.stats.shareCount || 0
    },
    duration: d.duration || 0,
    cover: d.video && d.video.cover || "",
    video: {
      no_watermark: (d.video && (d.video.noWatermark || d.video.playAddr)) || "",
      watermark: (d.video && d.video.watermark) || "",
      hd: (d.video && (d.video.hd || d.video.noWatermark)) || ""
    },
    audio: {
      url: (d.music && (d.music.playUrl || d.music.url)) || "",
      title: (d.music && d.music.title) || "",
      author: (d.music && d.music.author) || ""
    }
  };
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const tiktokUrl = url.searchParams.get("url");
  const hd = url.searchParams.get("hd") === "1" ? 1 : 0;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300"
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers });
  }

  if (!tiktokUrl) {
    return new Response(JSON.stringify({ ok: false, error: "missing 'url' parameter" }),
      { status: 400, headers });
  }

  if (!/tiktok\.com|douyin\.com/i.test(tiktokUrl)) {
    return new Response(JSON.stringify({ ok: false, error: "URL harus dari TikTok" }),
      { status: 400, headers });
  }

  const errors = [];

  // try provider 1
  try {
    const data = await tryTikWM(tiktokUrl, hd);
    return new Response(JSON.stringify({ ok: true, ...data }),
      { status: 200, headers });
  } catch (e) {
    errors.push({ provider: "tikwm", error: e.message });
  }

  // try provider 2
  try {
    const data = await tryTiklydown(tiktokUrl);
    return new Response(JSON.stringify({ ok: true, ...data }),
      { status: 200, headers });
  } catch (e) {
    errors.push({ provider: "tiklydown", error: e.message });
  }

  // semua provider gagal
  return new Response(JSON.stringify({
    ok: false,
    error: "Semua provider gagal mengambil data",
    details: errors,
    input_url: tiktokUrl
  }), { status: 502, headers });
}
