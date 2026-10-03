// TikTok Downloader — Cloudflare Pages Function (dense + robust)
// Providers: tikwm → douyin.wtf → ssstik → tikxedd

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T = { json: 1_000_000, html: 2_000_000, url: 2048, err: 6 };
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
const HOST_OK = ["tiktok.com", "douyin.com", "iesdouyin.com"];
const HOST_BAD = [/^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^\[?::1\]?$/, /metadata\.google\.internal$/i];
const CB = new Map(); // name → {f, t}

// ─── utils ───
const clamp = (v, n = 500) => { const s = v == null ? "" : String(v); return s.length > n ? s.slice(0, n) : s; };
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const dur = (v) => { const n = num(v); return n <= 0 ? 0 : Math.round(n > 10_000 ? n / 1000 : n); };
const html = (s) => String(s).replace(/&(?:amp|#0*38);/g, "&").replace(/&(?:quot|#0*34);/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function safeUrl(u) {
  const s = clamp(u, 2048); if (!s) return "";
  try {
    const p = new URL(s);
    if (!/^https?:$/.test(p.protocol)) return "";
    if (HOST_BAD.some(r => r.test(p.hostname))) return "";
    return p.toString();
  } catch { return ""; }
}

function validate(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "missing url" };
  if (raw.length > T.url) return { ok: false, reason: "url too long" };
  let u; try { u = new URL(raw.trim()); } catch { return { ok: false, reason: "malformed url" }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, reason: "only http/https" };
  const h = u.hostname.toLowerCase();
  if (HOST_BAD.some(r => r.test(h))) return { ok: false, reason: "host blocked" };
  if (!HOST_OK.some(d => h === d || h.endsWith("." + d))) return { ok: false, reason: "not tiktok/douyin host" };
  return { ok: true, url: u.toString() };
}

function result(o) {
  const v = o.video || {}, a = o.audio || {}, au = o.author || {}, s = o.stats || {};
  return {
    ok: true, provider: clamp(o.provider, 32), id: clamp(o.id, 64), title: clamp(o.title, 800),
    author: { id: clamp(au.id, 128), nickname: clamp(au.nickname, 200), avatar: safeUrl(au.avatar) },
    stats: { plays: num(s.plays), likes: num(s.likes), comments: num(s.comments), shares: num(s.shares) },
    duration: dur(o.duration), cover: safeUrl(o.cover),
    video: { no_watermark: safeUrl(v.no_watermark), watermark: safeUrl(v.watermark), hd: safeUrl(v.hd) },
    audio: { url: safeUrl(a.url), title: clamp(a.title, 300), author: clamp(a.author, 200) }
  };
}
const valid = r => r.ok && !!(r.video.no_watermark || r.video.hd || r.video.watermark);

// ─── circuit breaker ───
const cbOpen = (n) => { const s = CB.get(n); if (!s || s.f < 3) return false; if (Date.now() - s.t >= 60_000) { CB.delete(n); return false; } return true; };
const cbOk   = (n) => CB.delete(n);
const cbFail = (n) => { const s = CB.get(n) || { f: 0, t: 0 }; s.f++; if (s.f >= 3) s.t = Date.now(); CB.set(n, s); };

// ─── network ───
async function req(url, opts = {}, ms = 12_000, cap = T.json) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: c.signal, redirect: "follow" });
    if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; e.retryable = RETRYABLE.has(r.status); throw e; }
    const rd = r.body?.getReader?.(); if (!rd) return await r.text();
    const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await rd.read(); if (done) break;
      total += value.byteLength;
      if (total > cap) { try { rd.cancel(); } catch {} throw new Error(`body > ${cap}B`); }
      chunks.push(value);
    }
    const buf = new Uint8Array(total); let off = 0;
    for (const c2 of chunks) { buf.set(c2, off); off += c2.byteLength; }
    return new TextDecoder().decode(buf);
  } catch (e) {
    if (e?.name === "AbortError") { const err = new Error(`timeout ${ms}ms`); err.retryable = true; throw err; }
    throw e;
  } finally { clearTimeout(t); }
}

async function reqJson(url, opts, ms) {
  const txt = await req(url, { ...opts, headers: { "User-Agent": UA, "Accept": "application/json, */*", ...(opts?.headers || {}) } }, ms, T.json);
  const h = txt.trim()[0];
  if (h !== "{" && h !== "[") throw new Error(`non-JSON: ${txt.slice(0, 100)}`);
  try { return JSON.parse(txt); } catch { throw new Error(`bad JSON: ${txt.slice(0, 100)}`); }
}

async function reqHtml(url, opts, ms) {
  return req(url, { ...opts, headers: { "User-Agent": UA, "Accept": "text/html,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", ...(opts?.headers || {}) } }, ms, T.html);
}

// ─── providers ───
const providers = [
  { name: "tikwm", w: 100, ms: 10_000, async run(url, hd) {
      const d = await reqJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd}`,
        { headers: { Referer: "https://www.tikwm.com/", Origin: "https://www.tikwm.com" } }, this.ms);
      if (d?.code !== 0 || !d?.data) throw new Error(d?.msg || "tikwm empty");
      const v = d.data;
      return result({ provider: "tikwm", id: v.id, title: v.title,
        author: { id: v.author?.unique_id, nickname: v.author?.nickname, avatar: v.author?.avatar },
        stats: { plays: v.play_count, likes: v.digg_count, comments: v.comment_count, shares: v.share_count },
        duration: v.duration, cover: v.cover,
        video: { no_watermark: v.play, watermark: v.wmplay, hd: v.hdplay },
        audio: { url: v.music, title: v.music_info?.title, author: v.music_info?.author } });
  }},

  { name: "douyin.wtf", w: 80, ms: 12_000, async run(url) {
      const d = await reqJson(`https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=false`, {}, this.ms);
      const v = d?.data || d;
      if (!v || (!v.aweme_id && !v.video)) throw new Error("douyin.wtf bad payload");
      const vo = v.video || {};
      const play = vo.play_addr?.url_list?.[0] || v.play_addr?.url_list?.[0] || vo.download_addr?.url_list?.[0] || "";
      return result({ provider: "douyin.wtf", id: v.aweme_id, title: v.desc,
        author: { id: v.author?.unique_id, nickname: v.author?.nickname, avatar: v.author?.avatar_thumb?.url_list?.[0] },
        stats: { plays: v.statistics?.play_count, likes: v.statistics?.digg_count, comments: v.statistics?.comment_count, shares: v.statistics?.share_count },
        duration: v.duration || vo.duration, cover: vo.cover?.url_list?.[0] || v.cover?.url_list?.[0],
        video: { no_watermark: play.replace("/playwm/", "/play/"), watermark: vo.download_addr?.url_list?.[0] || "", hd: vo.play_addr_h264?.url_list?.[0] || play },
        audio: { url: v.music?.play_url?.url_list?.[0] || v.music?.play_url?.uri, title: v.music?.title, author: v.music?.author } });
  }},

  { name: "ssstik", w: 50, ms: 15_000, async run(url) {
      const p = await reqHtml("https://ssstik.io/en", {}, this.ms);
      const token = (p.match(/s_tt\s*=\s*['"]([^'"]+)['"]/) || [])[1] || (p.match(/name=["']token["']\s+value=["']([^"']+)["']/) || [])[1] || "";
      const body = new URLSearchParams({ id: url, locale: "en", ...(token ? { tt: token } : {}) });
      const r = await reqHtml("https://ssstik.io/abc?url=dl", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: "https://ssstik.io/en", Origin: "https://ssstik.io",
                   "hx-request": "true", "hx-trigger": "_gcaptcha_pt", "hx-target": "target", "hx-current-url": "https://ssstik.io/en" },
        body: body.toString()
      }, this.ms);
      const vm = r.match(/href=["'](https?:\/\/[^"']+?\.mp4[^"']*)["']/i);
      const am = r.match(/href=["'](https?:\/\/[^"']+?\.mp3[^"']*)["']/i);
      if (!vm) throw new Error("ssstik: no .mp4 link");
      const v = html(vm[1]);
      return result({ provider: "ssstik", video: { no_watermark: v, hd: v }, audio: { url: am ? html(am[1]) : "" } });
  }},

  { name: "tikxedd", w: 10, ms: 10_000, async run(url) {
      const d = await reqJson(`https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`, { headers: { Referer: "https://tikxedd.vercel.app/" } }, this.ms);
      const vd = d?.download || d || {};
      const nw = vd.noWatermark || vd.no_watermark || vd.play || "";
      if (!nw) throw new Error("tikxedd empty");
      return result({ provider: "tikxedd", id: d.id, title: d.description || d.title,
        author: { id: d.author, nickname: d.author }, duration: d.meta?.duration,
        video: { no_watermark: nw, watermark: vd.watermark, hd: vd.hd || nw } });
  }}
].sort((a, b) => b.w - a.w);

// ─── retry ───
async function withRetry(p, url, hd, log) {
  let last;
  for (let i = 1; i <= 2; i++) {
    try { return await p.run.call(p, url, hd); }
    catch (e) {
      last = e;
      const ok = e?.retryable === true || /timeout|network|fetch failed|ECONNRESET/i.test(String(e?.message || ""));
      if (!ok || i === 2) break;
      const d = Math.min(400 * 2 ** (i - 1), 2500) + Math.floor(Math.random() * 200);
      log("warn", "retry", { provider: p.name, attempt: i, delay: d });
      await new Promise(r => setTimeout(r, d));
    }
  }
  throw last;
}

// ─── response ───
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
               "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400",
               "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const jr = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", ...h } });

// ─── handler ───
export async function onRequest({ request }) {
  const rid = crypto.randomUUID();
  const t0 = Date.now();
  const log = (lv, msg, m) => console[lv === "error" ? "error" : lv](JSON.stringify({ ts: new Date().toISOString(), lv, rid, msg, ...(m && { m }) }));

  try {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET")     return jr({ ok: false, error: "method not allowed", rid }, 405);

    const q = new URL(request.url).searchParams;
    const raw = q.get("url");
    const hd = q.get("hd") === "1" ? 1 : 0;
    const dbg = q.get("debug") === "1";

    const v = validate(raw);
    if (!v.ok) return jr({ ok: false, error: v.reason, rid }, 400);

    log("log", "start", { url: v.url, hd });
    const errors = [];
    let tried = 0;

    for (const p of providers) {
      if (cbOpen(p.name)) { errors.push({ provider: p.name, error: "circuit open" }); continue; }
      tried++;
      try {
        const r = await withRetry(p, v.url, hd, log);
        if (!valid(r)) { cbFail(p.name); errors.push({ provider: p.name, error: "invalid video URL" }); continue; }
        cbOk(p.name);
        const el = Date.now() - t0;
        log("log", "success", { provider: p.name, elapsed: el });
        return jr(r, 200, { "X-Provider-Used": p.name, "X-Request-Id": rid, "X-Elapsed-Ms": String(el) });
      } catch (e) {
        cbFail(p.name);
        const m = clamp(e?.message || e, 200);
        errors.push({ provider: p.name, error: m });
        log("warn", "fail", { provider: p.name, error: m });
      }
    }

    log("error", "all failed", { tried, errors });
    const body = { ok: false, error: "all providers failed", rid, providers_tried: tried };
    if (dbg) { body.details = errors.slice(0, T.err); body.input_url = v.url; }
    return jr(body, 502);
  } catch (fatal) {
    log("error", "unhandled", { error: clamp(fatal?.stack || fatal?.message || fatal, 400) });
    return jr({ ok: false, error: "internal server error", rid }, 500);
  }
}
