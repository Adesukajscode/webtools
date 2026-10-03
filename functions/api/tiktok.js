// TikTok Downloader — Cloudflare Pages Function
// Multi-provider fallback: TikWM, TikXedd, Douyin.wtf, SSSTik

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT_MS = 15000;

async function fetchTimeout(url, opts = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function normalize(data) {
  return {
    ok: true,
    provider: data.provider || "unknown",
    id: data.id || "",
    title: data.title || "",
    author: {
      id: data.author?.id || "",
      nickname: data.author?.nickname || "",
      avatar: data.author?.avatar || ""
    },
    stats: {
      plays: data.stats?.plays || 0,
      likes: data.stats?.likes || 0,
      comments: data.stats?.comments || 0,
      shares: data.stats?.shares || 0
    },
    duration: data.duration || 0,
    cover: data.cover || "",
    video: {
      no_watermark: data.video?.no_watermark || "",
      watermark: data.video?.watermark || "",
      hd: data.video?.hd || ""
    },
    audio: {
      url: data.audio?.url || "",
      title: data.audio?.title || "",
      author: data.audio?.author || ""
    }
  };
}

// ─── PROVIDER 1: TikWM ───
async function tryTikWM(url, hd) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd}`;
  const r = await fetchTimeout(apiUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.tikwm.com/",
      "Origin": "https://www.tikwm.com"
    }
  });
  if (!r.ok) throw new Error(`tikwm HTTP ${r.status}`);
  const d = await r.json();
  if (d.code !== 0 || !d.data) throw new Error(d.msg || "tikwm empty");
  const v = d.data;
  return normalize({
    provider: "tikwm",
    id: v.id,
    title: v.title,
    author: { id: v.author?.unique_id, nickname: v.author?.nickname, avatar: v.author?.avatar },
    stats: { plays: v.play_count, likes: v.digg_count, comments: v.comment_count, shares: v.share_count },
    duration: v.duration, cover: v.cover,
    video: { no_watermark: v.play, watermark: v.wmplay, hd: v.hdplay },
    audio: { url: v.music, title: v.music_info?.title, author: v.music_info?.author }
  });
}

// ─── PROVIDER 2: TikXedd (dari riset: free, no signup) ───
async function tryTikxedd(url) {
  const apiUrl = `https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`;
  const r = await fetchTimeout(apiUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      "Referer": "https://tikxedd.vercel.app/"
    }
  });
  if (!r.ok) throw new Error(`tikxedd HTTP ${r.status}`);
  const d = await r.json();
  if (!d || !d.download) throw new Error("tikxedd empty");

  const vd = d.download;
  return normalize({
    provider: "tikxedd",
    id: d.id,
    title: d.description,
    author: { id: d.author, nickname: d.author },
    duration: d.meta?.duration,
    video: {
      no_watermark: vd.noWatermark || vd.no_watermark || "",
      watermark: vd.watermark || "",
      hd: vd.hd || vd.noWatermark || ""
    }
  });
}

// ─── PROVIDER 3: Douyin.wtf (public instance) ───
async function tryDouyinWtf(url) {
  const apiUrl = `https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=false`;
  const r = await fetchTimeout(apiUrl, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`douyin.wtf HTTP ${r.status}`);
  const d = await r.json();

  const v = d.data || d;
  if (!v || !v.video_data) throw new Error("douyin.wtf empty");

  const vd = v.video_data;
  const playUrl = vd.play_addr?.url_list?.[0] || vd.download_addr?.url_list?.[0] || "";
  const musicUrl = vd.music?.play_url?.url_list?.[0] || "";

  return normalize({
    provider: "douyin.wtf",
    id: vd.aweme_id,
    title: vd.desc,
    author: {
      id: vd.author?.unique_id,
      nickname: vd.author?.nickname,
      avatar: vd.author?.avatar_thumb?.url_list?.[0]
    },
    stats: {
      plays: vd.statistics?.play_count,
      likes: vd.statistics?.digg_count,
      comments: vd.statistics?.comment_count,
      shares: vd.statistics?.share_count
    },
    duration: vd.duration,
    cover: vd.cover?.url_list?.[0],
    video: {
      no_watermark: playUrl.replace("/playwm/", "/play/"),
      watermark: vd.download_addr?.url_list?.[0],
      hd: playUrl
    },
    audio: { url: musicUrl, title: vd.music?.title, author: vd.music?.author }
  });
}

// ─── PROVIDER 4: SSSTik (HTML scrape, dari riset) ───
async function trySSSTik(url) {
  const page = await fetchTimeout("https://ssstik.io/en", {
    headers: { "User-Agent": UA, "Accept": "text/html" }
  });
  if (!page.ok) throw new Error(`ssstik page HTTP ${page.status}`);
  const html = await page.text();

  const tokenMatch = html.match(/s_tt\s*=\s*"([^"]+)"/) ||
                     html.match(/name="token"\s+value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : "";

  const body = new URLSearchParams();
  body.append("id", url);
  if (token) body.append("token", token);

  const r = await fetchTimeout("https://ssstik.io/abc?url=dl", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://ssstik.io/en",
      "Origin": "https://ssstik.io",
      "HX-Request": "true",
      "HX-Trigger": "_gcaptcha_pt",
      "HX-Target": "target",
      "HX-Current-URL": "https://ssstik.io/en"
    },
    body: body.toString()
  });

  if (!r.ok) throw new Error(`ssstik HTTP ${r.status}`);
  const resHtml = await r.text();

  const vMatch = resHtml.match(/href="(https?:\/\/[^"]*\.mp4[^"]*)"/i);
  const aMatch = resHtml.match(/href="(https?:\/\/[^"]*\.mp3[^"]*)"/i);

  if (!vMatch) throw new Error("ssstik: link tidak ditemukan");

  return normalize({
    provider: "ssstik",
    video: { no_watermark: vMatch[1], hd: vMatch[1] },
    audio: { url: aMatch ? aMatch[1] : "" }
  });
}

// ─── MAIN ───
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const tiktokUrl = url.searchParams.get("url");
  const hd = url.searchParams.get("hd") === "1" ? 1 : 0;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  if (request.method === "OPTIONS") return new Response("", { status: 200, headers });

  if (!tiktokUrl) return new Response(JSON.stringify({ ok: false, error: "missing 'url'" }), { status: 400, headers });
  if (!/tiktok\.com|douyin\.com/i.test(tiktokUrl)) return new Response(JSON.stringify({ ok: false, error: "URL harus dari TikTok" }), { status: 400, headers });

  const errors = [];
  const providers = [
    { name: "tikwm", fn: () => tryTikWM(tiktokUrl, hd) },
    { name: "tikxedd", fn: () => tryTikxedd(tiktokUrl) },
    { name: "douyin.wtf", fn: () => tryDouyinWtf(tiktokUrl) },
    { name: "ssstik", fn: () => trySSSTik(tiktokUrl) }
  ];

  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result.video && (result.video.no_watermark || result.video.hd)) {
        return new Response(JSON.stringify(result), { status: 200, headers });
      }
      errors.push({ provider: p.name, error: "no video URL" });
    } catch (e) {
      errors.push({ provider: p.name, error: String(e.message || e).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({
    ok: false,
    error: "Semua provider gagal.",
    details: errors,
    input_url: tiktokUrl
  }), { status: 502, headers });
}
