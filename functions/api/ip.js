export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const ip = url.searchParams.get("ip") || "";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const target = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
    const r = await fetch(target);
    const data = await r.json();
    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers });
  }
}
