// ═════════════════════════════════════════════════════════════
// TikTok Downloader — Cloudflare Pages Function
// Sumber: cobalt api (api.cobalt.tools), tikxedd, douyin.wtf demo
// ═════════════════════════════════════════════════════════════

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T = 14000;

async function ft(url, opts = {}, ms = T) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

function norm(d) {
  return {
    ok: true,
    provider: d.provider || "unknown",
    id: d.id || "",
    title: d.title || "",
    author: {
      id: d.author?.id || "",
      nickname: d.author?.nickname || "",
      avatar: d.author?.avatar || ""
    },
    stats: {
      plays: d.stats?.plays || 0,
      likes: d.stats?.likes || 0,
      comments: d.stats?.comments || 0,
      shares: d.stats?.shares || 0
    },
    duration: d.duration || 0,
    cover: d.cover || "",
    video: {
      no_watermark: d.video?.no_watermark || "",
      watermark: d.video?.watermark || "",
      hd: d.video?.hd || ""
    },
    audio: {
      url: d.audio?.url || "",
      title: d.audio?.title || "",
      author: d.audio?.author || ""
    }
  };
}

// ═════════════════════════════════════════════════════════════
// PROVIDER 1: Cobalt API (paling reliable, dokumentasi resmi)
// POST /api/json  → { url, videoQuality, tiktokFullAudio }
// Response: { status: "redirect"|"tunnel"|"success", url, audio }
// ═════════════════════════════════════════════════════════════
async function pCobalt(url) {
  const endpoints = [
    "https://api.cobalt.tools",
    "https://cobalt-api.kwiatekmiki.com"
  ];

  let lastErr;
  for (const base of endpoints) {
    try {
      const r = await ft(`${base}/api/json`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": UA
        },
        body: JSON.stringify({
          url: url,
          videoQuality: "1080",
          tiktokFullAudio: true,
          filenameStyle: "basic"
        })
      });

      if (!r.ok) { lastErr = `cobalt ${base} HTTP ${r.status}`; continue; }
      const d = await r.json();

      if (d.status === "error") { lastErr = `cobalt err: ${d.error?.code || d.text || "unknown"}`; continue; }
      if (d.status === "rate-limit") { lastErr = "cobalt rate limited"; continue; }
      if (d.status !== "redirect" && d.status !== "tunnel" && d.status !== "success") {
        lastErr = `cobalt unexpected: ${d.status}`; continue;
      }
      if (!d.url) { lastErr = "cobalt no url"; continue; }

      return norm({
        provider: `cobalt:${new URL(base).hostname}`,
        video: { no_watermark: d.url, hd: d.url, watermark: "" },
        audio: { url: d.audio || "" }
      });
    } catch (e) {
      lastErr = `cobalt ${base} err: ${String(e.message || e).slice(0, 100)}`;
    }
  }
  throw new Error(lastErr || "cobalt failed");
}

// ═════════════════════════════════════════════════════════════
// PROVIDER 2: TikXedd API (free, no signup)
// GET /api/resolve?url=<tiktok_url>
// Response: { id, author, description, download: { noWatermark, watermark } }
// ═════════════════════════════════════════════════════════════
async function pTikXedd(url) {
  const r = await ft(`https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      "Referer": "https://tikxedd.vercel.app/"
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();

  if (!d || (!d.download && !d.video)) throw new Error("empty response");

  const vd = d.download || d.video || {};
  const playUrl = vd.noWatermark || vd.no_watermark || vd.play || "";
  if (!playUrl) throw new Error("no video URL");

  return norm({
    provider: "tikxedd",
    id: d.id,
    title: d.description || d.title,
    author: {
      id: d.author || "",
      nickname: d.nickname || d.author || ""
    },
    duration: d.meta?.duration || 0,
    cover: d.cover || "",
    video: {
      no_watermark: playUrl,
      watermark: vd.watermark || "",
      hd: vd.hd || playUrl
    },
    audio: {
      url: vd.music || vd.audio || ""
    }
  });
}

// ═════════════════════════════════════════════════════════════
// PROVIDER 3: Douyin.wtf demo instance (public API key)
// GET /api/hybrid/video_data?url=<url>
// ═════════════════════════════════════════════════════════════
async function pDouyinWtf(url) {
  const r = await ft(`https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=true`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json"
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();

  const v = d.data || d;
  if (!v || !v.video) throw new Error("empty response");

  const vd = v.video;
  const playList = vd.play_addr_h264?.url_list
                || vd.play_addr?.url_list
                || vd.download_addr?.url_list
                || [];
  const playUrl = playList[0] || "";
  if (!playUrl) throw new Error("no play URL");

  const musicUrl = v.music?.play_url?.url_list?.[0] || "";

  return norm({
    provider: "douyin.wtf",
    id: v.aweme_id,
    title: v.desc,
    author: {
      id: v.author?.unique_id,
      nickname: v.author?.nickname,
      avatar: v.author?.avatar_thumb?.url_list?.[0]
    },
    stats: {
      plays: v.statistics?.play_count,
      likes: v.statistics?.digg_count,
      comments: v.statistics?.comment_count,
      shares: v.statistics?.share_count
    },
    duration: v.duration,
    cover: v.cover?.url_list?.[0],
    video: {
      no_watermark: playUrl.replace("/playwm/", "/play/"),
      watermark: vd.download_addr?.url_list?.[0] || "",
      hd: playUrl
    },
    audio: {
      url: musicUrl,
      title: v.music?.title,
      author: v.music?.author
    }
  });
}

// ═════════════════════════════════════════════════════════════
// PROVIDER 4: TikWM (fallback terakhir, dengan header lengkap)
// ═════════════════════════════════════════════════════════════
async function pTikWM(url, hd) {
  const r = await ft(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd}`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.tikwm.com/",
      "Origin": "https://www.tikwm.com"
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d.code !== 0 || !d.data) throw new Error(d.msg || "empty");

  const v = d.data;
  return norm({
    provider: "tikwm",
    id: v.id,
    title: v.title,
    author: {
      id: v.author?.unique_id,
      nickname: v.author?.nickname,
      avatar: v.author?.avatar
    },
    stats: {
      plays: v.play_count,
      likes: v.digg_count,
      comments: v.comment_count,
      shares: v.share_count
    },
    duration: v.duration,
    cover: v.cover,
    video: {
      no_watermark: v.play,
      watermark: v.wmplay,
      hd: v.hdplay
    },
    audio: {
      url: v.music,
      title: v.music_info?.title,
      author: v.music_info?.author
    }
  });
}

// ═════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════
export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const tiktokUrl = u.searchParams.get("url");
  const hd = u.searchParams.get("hd") === "1" ? 1 : 0;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  if (request.method === "OPTIONS") return new Response("", { status: 200, headers });
  if (!tiktokUrl) return new Response(JSON.stringify({ ok: false, error: "missing url" }), { status: 400, headers });
  if (!/tiktok\.com|douyin\.com/i.test(tiktokUrl)) return new Response(JSON.stringify({ ok: false, error: "URL harus dari TikTok" }), { status: 400, headers });

  const errors = [];
  const providers = [
    { name: "cobalt",     fn: () => pCobalt(tiktokUrl) },
    { name: "tikxedd",    fn: () => pTikXedd(tiktokUrl) },
    { name: "douyin.wtf", fn: () => pDouyinWtf(tiktokUrl) },
    { name: "tikwm",      fn: () => pTikWM(tiktokUrl, hd) }
  ];

  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result.video && (result.video.no_watermark || result.video.hd)) {
        return new Response(JSON.stringify(result), { status: 200, headers });
      }
      errors.push({ provider: p.name, error: "no video URL" });
    } catch (e) {
      errors.push({ provider: p.name, error: String(e.message || e).slice(0, 180) });
    }
  }

  return new Response(JSON.stringify({
    ok: false,
    error: "Semua provider gagal.",
    details: errors,
    input_url: tiktokUrl,
    timestamp: new Date().toISOString()
  }), { status: 502, headers });
}
