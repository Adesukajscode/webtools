// TikTok Downloader — Cloudflare Pages Function
// Fokus provider aktif 2026 (riset: tikxedd, tiklydown, ssstik)

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

// ─── 1. TikXedd (paling reliable dari riset) ───
async function pTikxedd(url) {
  const r = await ft(`https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();

  // cek apakah response valid
  if (!d || (!d.download && !d.video)) throw new Error("response kosong");

  const vd = d.download || d.video;
  const playUrl = vd.noWatermark || vd.no_watermark || vd.play || "";

  if (!playUrl) throw new Error("tidak ada URL video");

  return norm({
    provider: "tikxedd",
    id: d.id,
    title: d.description || d.title,
    author: {
      id: d.author || d.author_id,
      nickname: d.nickname || d.author
    },
    duration: d.meta?.duration || d.duration,
    video: {
      no_watermark: playUrl,
      watermark: vd.watermark || "",
      hd: vd.hd || playUrl
    }
  });
}

// ─── 2. Tiklydown ───
async function pTiklydown(url) {
  const r = await ft(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d || !d.video) throw new Error("response kosong");

  const v = d.video;
  const playUrl = v.noWatermark || v.playAddr || v.watermark || "";
  if (!playUrl) throw new Error("tidak ada URL video");

  return norm({
    provider: "tiklydown",
    id: d.id,
    title: d.title,
    author: {
      id: d.author?.unique_id,
      nickname: d.author?.nickname,
      avatar: d.author?.avatar
    },
    stats: {
      plays: d.stats?.playCount,
      likes: d.stats?.diggCount,
      comments: d.stats?.commentCount,
      shares: d.stats?.shareCount
    },
    duration: d.duration,
    cover: v.cover,
    video: {
      no_watermark: v.noWatermark || v.playAddr,
      watermark: v.watermark,
      hd: v.hd || v.noWatermark
    },
    audio: {
      url: d.music?.playUrl || d.music?.url,
      title: d.music?.title,
      author: d.music?.author
    }
  });
}

// ─── 3. SSSTik (fallback terakhir) ───
async function pSSSTik(url) {
  const page = await ft("https://ssstik.io/en", {
    headers: { "User-Agent": UA, "Accept": "text/html" }
  });
  if (!page.ok) throw new Error(`page HTTP ${page.status}`);
  const html = await page.text();

  const m = html.match(/s_tt\s*=\s*"([^"]+)"/) || html.match(/name="token"\s+value="([^"]+)"/);
  const token = m ? m[1] : "";
  if (!token) throw new Error("token tidak ditemukan");

  const body = new URLSearchParams();
  body.append("id", url);
  body.append("locale", "en");
  body.append("tt", token);

  const r = await ft("https://ssstik.io/abc?url=dl", {
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
  if (!r.ok) throw new Error(`POST HTTP ${r.status}`);
  const res = await r.text();

  const vM = res.match(/href="(https?:\/\/[^"]*\.mp4[^"]*)"/i);
  const aM = res.match(/href="(https?:\/\/[^"]*\.mp3[^"]*)"/i);
  if (!vM) throw new Error("link mp4 tidak ditemukan");

  return norm({
    provider: "ssstik",
    video: { no_watermark: vM[1], hd: vM[1] },
    audio: { url: aM ? aM[1] : "" }
  });
}

// ─── MAIN ───
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
    { name: "tikxedd", fn: () => pTikxedd(tiktokUrl) },
    { name: "tiklydown", fn: () => pTiklydown(tiktokUrl) },
    { name: "ssstik", fn: () => pSSSTik(tiktokUrl) }
  ];

  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result.video && (result.video.no_watermark || result.video.hd)) {
        return new Response(JSON.stringify(result), { status: 200, headers });
      }
      errors.push({ provider: p.name, error: "no video URL" });
    } catch (e) {
      errors.push({ provider: p.name, error: String(e.message || e).slice(0, 150) });
    }
  }

  return new Response(JSON.stringify({
    ok: false,
    error: "Semua provider gagal.",
    details: errors
  }), { status: 502, headers });
}
