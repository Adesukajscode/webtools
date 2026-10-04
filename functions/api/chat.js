// Groq API Proxy — OpenAI-compatible, free tier
const ENDPOINT="https://api.groq.com/openai/v1/chat/completions";
const SYS=`Kamu NEXA, asisten AI ramah untuk website CyberToolbox (webtools-vex.pages.dev).
Website punya 30+ tools: downloader (TikTok/YouTube/IG/FB/Spotify/APK), media (AI Upscale, Color Grading, Video Stabilizer), AI/CV (Face Recognition, Hand Tracking), game (Game Arcade, Slot, YouTube Player, Wikipedia), utility (Hash, JWT, QR, Password, dll).
Bisa jawab APERTANYAAN APAPUN. Jawab SINGKAT (maks 4 paragraf), ramah, Bahasa Indonesia. Pakai emoji seperlunya.`;

export async function onRequest(context){
  const{request,env}=context;
  const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers:H});
  if(request.method!=="POST")return new Response(JSON.stringify({ok:!1,error:"POST only"}),{status:405,headers:H});

  const KEY=env.GROQ_API_KEY;
  if(!KEY)return new Response(JSON.stringify({ok:!1,error:"Server belum dikonfigurasi. Admin: set GROQ_API_KEY di Cloudflare Pages environment."}),{status:500,headers:H});

  try{
    const body=await request.json();
    const msgs=Array.isArray(body.messages)?body.messages.slice(-10):[];
    const model=body.model||"llama-3.3-70b-versatile";
    if(!msgs.length)return new Response(JSON.stringify({ok:!1,error:"no messages"}),{status:400,headers:H});

    const payload={
      model,
      messages:[{role:"system",content:SYS},...msgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,4000)}))],
      max_tokens:1024,
      temperature:0.7,
      stream:false
    };

    const r=await fetch(ENDPOINT,{
      method:"POST",
      headers:{"Authorization":"Bearer "+KEY,"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });

    const d=await r.json();
    if(!r.ok){
      const err=(d&&d.error&&d.error.message)||("Groq HTTP "+r.status);
      return new Response(JSON.stringify({ok:!1,error:err}),{status:r.status,headers:H})
    }

    const reply=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
    if(!reply)return new Response(JSON.stringify({ok:!1,error:"Empty response"}),{status:502,headers:H});

    return new Response(JSON.stringify({ok:!0,reply:reply.trim(),model}),{status:200,headers:H})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200)}),{status:500,headers:H})
  }
}
