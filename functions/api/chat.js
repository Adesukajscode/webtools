// Cloudflare Workers AI Proxy — free tier 10K neurons/day
const MODELS=["@cf/meta/llama-3.2-3b-instruct","@cf/meta/llama-3.1-8b-instruct","@cf/qwen/qwen1.5-14b-chat-awq"];

const SYS=`Kamu NEXA, asisten AI ramah untuk website CyberToolbox (webtools-vex.pages.dev).
Website ini punya 30+ tools: downloader (TikTok/YouTube/IG/FB/Spotify/APK), media (AI Upscale, Color Grading, Video Stabilizer), AI/CV (Face Recognition, Hand Tracking), game (Game Arcade, Slot Kasino, YouTube Player, Wikipedia), utility (Hash, Base64, URL, Hex, JWT, UUID, Password, QR, JSON, Regex, Color, Cron, IP Lookup, Text, Time), info (Jam Jakarta, Device Info).
Kamu bisa jawab pertanyaan APAPUN — tentang website, teknologi, pelajaran, coding, atau topik umum.
Jawab SINGKAT, ramah, dalam Bahasa Indonesia. Pakai emoji seperlunya. Jangan pernah menolak pertanyaan wajar.`;

export async function onRequest(context){
  const{request,env}=context;
  const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers:H});
  if(request.method!=="POST")return new Response(JSON.stringify({ok:!1,error:"POST only"}),{status:405,headers:H});

  const ACC=env.CF_ACCOUNT_ID, TOK=env.CF_AI_TOKEN;
  if(!ACC||!TOK)return new Response(JSON.stringify({ok:!1,error:"Server belum dikonfigurasi. Admin: set CF_ACCOUNT_ID + CF_AI_TOKEN di Cloudflare Pages environment."}),{status:500,headers:H});

  try{
    const body=await request.json();
    const msgs=Array.isArray(body.messages)?body.messages.slice(-10):[];
    if(!msgs.length)return new Response(JSON.stringify({ok:!1,error:"no messages"}),{status:400,headers:H});

    const payload={
      messages:[{role:"system",content:SYS},...msgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,2000)}))],
      max_tokens:600,
      temperature:0.7
    };

    let lastErr="";
    for(const model of MODELS){
      try{
        const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`,{
          method:"POST",
          headers:{"Authorization":"Bearer "+TOK,"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        const d=await r.json();
        if(d.success&&d.result&&d.result.response){
          return new Response(JSON.stringify({ok:!0,reply:d.result.response.trim(),model}),{status:200,headers:H})
        }
        lastErr=JSON.stringify(d.errors||d.messages||d).slice(0,200)
      }catch(e){lastErr=String(e.message||e).slice(0,150)}
    }
    return new Response(JSON.stringify({ok:!1,error:"Semua model gagal: "+lastErr}),{status:502,headers:H})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200)}),{status:500,headers:H})
  }
}
