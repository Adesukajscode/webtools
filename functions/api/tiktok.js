// ═════════════════════════════════════════════════════════════
// TikTok Downloader — Cloudflare Pages Function
// Provider: btch-downloader-api, tikxedd, cobalt
// Referensi: github.com/boy-offi9-inc/btch-downloader-api
//            github.com/iorkdevvvv/Tikxedds-api
// ═════════════════════════════════════════════════════════════

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T = 15000;

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
    author: { id: d.author?.id || "", nickname: d.author?.nickname || "", avatar: d.author?.avatar || "" },
    stats: { plays: d.stats?.plays || 0, likes: d.stats?.likes || 0, comments: d.stats?.comments || 0, shares: d.stats?.shares || 0 },
    duration: d.duration || 0,
    cover: d.cover || "",
    video: { no_watermark: d.video?.no_watermark || "", watermark: d.video?.watermark || "", hd: d.video?.hd || "" },
    audio: { url: d.audio?.url || "", title: d.audio?.title || "", author: d.audio?.author || "" }
  };
}

// ─────────────────────────────────────────────
// PROVIDER 1: btch-downloader-api (Vercel live demo, no auth)
// GET /api/download/tiktok?url=<tiktok_url>
// ─────────────────────────────────────────────
async function pBtch(url) {
  const r = await ft(`https://btch-downloader-api-green.vercel.app/api/download/tiktok?url=${encodeURIComponent(url)}`, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();

  if (!d || !d.success) throw new Error(d?.error?.message || "response not ok");

  // normalize dari respons btch-downloader
  const res = d.result || {};
  const dl = res.download || res.data?.download || res.data || res;

  const playUrl = dl.video || dl.no_watermark || dl.play || dl.videoUrl
                || (dl.videoUrl && dl.videoUrl[0]) || "";
  const audioUrl = dl.audio || dl.music || dl.audioUrl || "";

  if (!playUrl) throw new Error("no video URL in result");

  return norm({
    provider: "btch",
    id: res.id || "",
    title: res.title || res.desc || "",
    author: { id: res.author || "", nickname: res.nickname || "" },
    duration: res.duration || 0,
    cover: res.thumbnail || res.cover || "",
    video: { no_watermark: playUrl, hd: playUrl, watermark: dl.wmplay || "" },
    audio: { url: audioUrl, title: res.music || "" }
  });
}

// ─────────────────────────────────────────────
// PROVIDER 2: TikXedd (no Referer — Referer block!)
// GET /api/resolve?url=<tiktok_url>
// ─────────────────────────────────────────────
async function pTikXedd(url) {
  const r = await ft(`https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json"
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
    author: { id: d.author || "", nickname: d.author || "" },
    duration: d.meta?.duration || 0,
    video: { no_watermark: playUrl, hd: playUrl, watermark: vd.watermark || "" },
    audio: { url: vd.music || "" }
  });
}

// ─────────────────────────────────────────────
// PROVIDER 3: Cobalt (community instance fallback)
// POST /api/json  {url, videoQuality, tiktokFullAudio}
// ─────────────────────────────────────────────
async function pCobalt(url) {
  const endpoints = [
    "https://api.cobalt.tools",
    "https://co.wuk.sh",
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
      if (!r.ok) { lastErr = `HTTP ${r.status}`; continue; }
      const d = await r.json();
      if (d.status === "error") { lastErr = d.error?.code || d.text || "error"; continue; }
      if (d.status === "rate-limit") { lastErr = "rate limited"; continue; }
      if (!d.url) { lastErr = "no url"; continue; }

      return norm({
        provider: `cobalt:${new URL(base).hostname}`,
        video: { no_watermark: d.url, hd: d.url, watermark: "" },
        audio: { url: d.audio || "" }
      });
    } catch (e) {
      lastErr = String(e.message || e).slice(0, 100);
    }
  }
  throw new Error(lastErr || "all cobalt instances failed");
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const tiktokUrl = u.searchParams.get("url");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  if (request.method === "OPTIONS") return new Response("", { status: 200, headers });
  if (!tiktokUrl) return new Response(JSON.stringify({ ok: false, error: "missing url" }), { status: 400, headers });
  if (!/tiktok\.com|douyin\.com/i.test(tiktokUrl)) return new Response(JSON.stringify({ ok: false, error: "URL harus TikTok" }), { status: 400, headers });

  const errors = [];
  const providers = [
    { name: "btch", fn: () => pBtch(tiktokUrl) },
    { name: "tikxedd", fn: () => pTikXedd(tiktokUrl) },
    { name: "cobalt", fn: () => pCobalt(tiktokUrl) }
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
    input_url: tiktokUrl
  }), { status: 502, headers });
}
