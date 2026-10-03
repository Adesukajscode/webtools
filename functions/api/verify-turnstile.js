// Verify Turnstile token via Cloudflare Siteverify API
// Secret key TEST (selalu lolos): 1x0000000000000000000000000000000AA
const SECRET="1x0000000000000000000000000000000AA"; // ← GANTI dengan secret asli

export async function onRequest(context){
  const{request}=context;
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  if(request.method!=="POST")return new Response(JSON.stringify({ok:!1,error:"POST only"}),{status:405,headers});
  try{
    const body=await request.json();
    const token=body&&body.token;
    if(!token)return new Response(JSON.stringify({ok:!1,error:"no token"}),{status:400,headers});
    const form=new FormData();
    form.append("secret",SECRET);
    form.append("response",token);
    form.append("remoteip",request.headers.get("CF-Connecting-IP")||"");
    const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});
    const d=await r.json();
    if(d.success)return new Response(JSON.stringify({ok:!0,challenge_ts:d.challenge_ts,hostname:d.hostname}),{status:200,headers});
    return new Response(JSON.stringify({ok:!1,error:"Verifikasi gagal","error-codes":d["error-codes"]||[]}),{status:400,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:e.message}),{status:500,headers})
  }
}
