exports.handler = async (event) => {
  const ip = event.queryStringParameters?.ip || '';
  const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
  try {
    const r = await fetch(url);
    const data = await r.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
