// ═══════════════════════════════════════════════════
// TikTok Downloader — Cloudflare Pages Function
// 6-provider fallback (riset 2026-10)
// ═══════════════════════════════════════════════════

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T = 12000;

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

// ─── 1. TikWM ───
async function pTikWM(url, hd) {
  const r = await ft(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd}`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/plain, */*",
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
    id: v.id, title: v.title,
    author: { id: v.author?.unique_id, nickname: v.author?.nickname, avatar: v.author?.avatar },
    stats: { plays: v.play_count, likes: v.digg_count, comments: v.comment_count, shares: v.share_count },
    duration: v.duration, cover: v.cover,
    video: { no_watermark: v.play, watermark: v.wmplay, hd: v.hdplay },
    audio: { url: v.music, title: v.music_info?.title, author: v.music_info?.author }
  });
}

// ─── 2. Douyin.wtf (path benar + response structure fix) ───
async function pDouyinWtf(url) {
  const r = await ft(`https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=false`, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const v = d.data || d;
  if (!v || !v.video) throw new Error("empty");

  // struktur: v.video.play_addr_h264.url_list[0]
  const vd = v.video;
  const playList = vd.play_addr_h264?.url_list
                || vd.play_addr?.url_list
                || vd.download_addr?.url_list
                || [];
  const playUrl = playList[0] || "";
  const musicUrl = v.music?.play_url?.url_list?.[0] || "";

  return norm({
    provider: "douyin.wtf",
    id: v.aweme_id, title: v.desc,
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
    duration: v.duration, cover: v.cover?.url_list?.[0],
    video: {
      no_watermark: playUrl.replace("/playwm/", "/play/").replace("watermark=1", "watermark=0"),
      watermark: vd.download_addr?.url_list?.[0],
      hd: playUrl
    },
    audio: { url: musicUrl, title: v.music?.title, author: v.music?.author }
  });
}

// ─── 3. Tiklydown ───
async function pTiklydown(url) {
  const r = await ft(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
    headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://tiklydown.eu.org/" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d || !d.video) throw new Error("empty");

  const v = d.video;
  const playUrl = v.noWatermark || v.playAddr || v.watermark || "";
  if (!playUrl) throw new Error("no video url");

  return norm({
    provider: "tiklydown",
    id: d.id, title: d.title,
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
    duration: d.duration, cover: v.cover,
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

// ─── 4. SSSTik (HTML scrape + HX headers) ───
async function pSSSTik(url) {
  // Step 1: GET halaman → ambil token
  const page = await ft("https://ssstik.io/en", {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" }
  });
  if (!page.ok) throw new Error(`page HTTP ${page.status}`);
  const html = await page.text();

  const m = html.match(/s_tt\s*=\s*"([^"]+)"/) || html.match(/name="token"\s+value="([^"]+)"/);
  const token = m ? m[1] : "";
  if (!token) throw new Error("token tidak ditemukan");

  // Step 2: POST
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

  // cari link mp4 / mp3
  const vM = res.match(/href="(https?:\/\/[^"]*\.mp4[^"]*)"/i);
  const aM = res.match(/href="(https?:\/\/[^"]*\.mp3[^"]*)"/i);
  if (!vM) throw new Error("link mp4 tidak ditemukan");

  // cari title
  const tM = res.match(/<p[^>]*class="[^"]*maintext[^"]*"[^>]*>([^<]+)/i);

  return norm({
    provider: "ssstik",
    title: tM ? tM[1].trim() : "",
    video: { no_watermark: vM[1], hd: vM[1] },
    audio: { url: aM ? aM[1] : "" }
  });
}

// ─── 5. TikMate (HTML scrape) ───
async function pTikMate(url) {
  const page = await ft("https://tikmate.online/", {
    headers: { "User-Agent": UA, "Accept": "text/html" }
  });
  if (!page.ok) throw new Error(`page HTTP ${page.status}`);
  const html = await page.text();

  const m = html.match(/name="token"\s+value="([^"]+)"/);
  const token = m ? m[1] : "";

  const body = new URLSearchParams();
  body.append("url", url);
  if (token) body.append("token", token);

  const r = await ft("https://tikmate.online/download", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://tikmate.online/",
      "Origin": "https://tikmate.online"
    },
    body: body.toString()
  });
  if (!r.ok) throw new Error(`POST HTTP ${r.status}`);
  const res = await r.text();

  const vM = res.match(/href="(https?:\/\/[^"]*\.mp4[^"]*)"/i);
  const aM = res.match(/href="(https?:\/\/[^"]*\.mp3[^"]*)"/i);
  if (!vM) throw new Error("link tidak ditemukan");

  return norm({
    provider: "tikmate",
    video: { no_watermark: vM[1], hd: vM[1] },
    audio: { url: aM ? aM[1] : "" }
  });
}

// ─── 6. SnapTik (HTML scrape, fallback terakhir) ───
async function pSnapTik(url) {
  const body = new URLSearchParams();
  body.append("url", url);

  const r = await ft("https://snaptik.app/abc2.php", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://snaptik.app/",
      "Origin": "https://snaptik.app"
    },
    body: body.toString()
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const res = await r.text();

  const vM = res.match(/href="(https?:\/\/[^"]*\.mp4[^"]*)"/i) || res.match(/(https?:\/\/[^"\s]*\.mp4)/i);
  if (!vM) throw new Error("link tidak ditemukan");

  return norm({
    provider: "snaptik",
    video: { no_watermark: vM[1], hd: vM[1] }
  });
}

// ─── MAIN ───
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
  if (!/tiktok\.com|douyin\.com/i.test(tiktokUrl)) return new Response(JSON.stringify({ ok: false, error: "URL harus TikTok" }), { status: 400, headers });

  const errors = [];
  const providers = [
    { name: "tikwm",      fn: () => pTikWM(tiktokUrl, hd) },
    { name: "douyin.wtf", fn: () => pDouyinWtf(tiktokUrl) },
    { name: "tiklydown",  fn: () => pTiklydown(tiktokUrl) },
    { name: "ssstik",     fn: () => pSSSTik(tiktokUrl) },
    { name: "tikmate",    fn: () => pTikMate(tiktokUrl) },
    { name: "snaptik",    fn: () => pSnapTik(tiktokUrl) }
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
    error: "Semua 6 provider gagal.",
    details: errors
  }), { status: 502, headers });
}
