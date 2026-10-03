// ─────────────────────────────────────────────
// TIKTOK DOWNLOADER — Netlify Function
// Endpoint: /.netlify/functions/tiktok?url=<TIKTOK_URL>
// ─────────────────────────────────────────────

const TIKWM_API = "https://www.tikwm.com/api/";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // handle OPTIONS (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // ambil URL dari query string
  const url = event.queryStringParameters?.url || "";
  if (!url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "missing 'url' parameter" })
    };
  }

  // validasi URL tiktok
  if (!/tiktok\.com|douyin\.com/.test(url)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "URL bukan dari TikTok" })
    };
  }

  // ekstrak video ID
  const idMatch = url.match(/\/video\/(\d+)/) || url.match(/\/v\/(\d+)/);
  if (!idMatch) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "URL TikTok tidak valid (video ID tidak ditemukan)" })
    };
  }

  // mode (hd atau normal)
  const hd = event.queryStringParameters?.hd === "1" ? 1 : 0;

  // coba provider 1: tikwm.com
  try {
    const apiUrl = `${TIKWM_API}?url=${encodeURIComponent(url)}&hd=${hd}`;
    const r = await fetch(apiUrl, {
      headers: { "User-Agent": USER_AGENT }
    });

    if (r.ok) {
      const d = await r.json();
      if (d.code === 0 && d.data) {
        const v = d.data;
        const response = {
          ok: true,
          provider: "tikwm",
          id: idMatch[1],
          title: v.title || "",
          author: {
            id: v.author?.unique_id || "",
            nickname: v.author?.nickname || "",
            avatar: v.author?.avatar || ""
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
            title: v.music_info?.title || "",
            author: v.music_info?.author || ""
          },
          created_at: v.create_time || 0,
          region: v.region || ""
        };

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(response)
        };
      }
    }
  } catch (e) {
    // lanjut ke provider berikutnya
  }

  // semua provider gagal
  return {
    statusCode: 502,
    headers,
    body: JSON.stringify({
      ok: false,
      error: "Semua provider gagal mengambil data. Coba lagi nanti.",
      url: url
    })
  };
};
