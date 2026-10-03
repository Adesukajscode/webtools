export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const tiktokUrl = url.searchParams.get("url");
  const hd = url.searchParams.get("hd") === "1" ? 1 : 0;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers });
  }

  if (!tiktokUrl) {
    return new Response(JSON.stringify({ ok: false, error: "missing url" }),
      { status: 400, headers });
  }

  if (!/tiktok\.com|douyin\.com/i.test(tiktokUrl)) {
    return new Response(JSON.stringify({ ok: false, error: "URL bukan TikTok" }),
      { status: 400, headers });
  }

  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&hd=${hd}`;
    const r = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
      }
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: `upstream ${r.status}` }),
        { status: 502, headers });
    }

    const d = await r.json();

    if (d.code !== 0 || !d.data) {
      return new Response(JSON.stringify({
        ok: false,
        error: d.msg || "provider tidak bisa resolve URL ini"
      }), { status: 502, headers });
    }

    const v = d.data;
    return new Response(JSON.stringify({
      ok: true,
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
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers });
  }
}
