const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T=20000;

async function ft(u,o={},m=T){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),m);
  try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}
}

function detect(url){
  const u=(url||"").toLowerCase();
  if(/youtube\.com|youtu\.be/.test(u))return"youtube";
  if(/instagram\.com/.test(u))return"instagram";
  if(/facebook\.com|fb\.watch/.test(u))return"facebook";
  if(/tiktok\.com/.test(u))return"tiktok";
  if(/spotify\.com/.test(u))return"spotify";
  if(/twitter\.com|x\.com/.test(u))return"twitter";
  if(/melolo/.test(u))return"melolo";
  if(/moviebox/.test(u))return"moviebox";
  return"unknown"
}

function norm(p,res,url){
  const out={ok:!0,platform:p,url,title:res.title||res.desc||res.name||"",author:res.author||res.channel||res.uploader||(Array.isArray(res.artists)?res.artists.join(", "):"")||"",thumbnail:res.thumbnail||res.cover||res.image||"",duration:res.duration||0,downloads:[]};
  const push=(label,u,q)=>{if(!u)return;const arr=Array.isArray(u)?u:[u];arr.forEach(x=>{const link=typeof x==="string"?x:(x.url||x.link||x.download_url);if(link&&/^https?:/.test(link)&&!out.downloads.find(d=>d.url===link))out.downloads.push({label,quality:q||"",url:link})})};
  const dl=res.download||res.downloads||res.medias||res.data||res;
  if(typeof dl==="string")push("Download",dl);
  else if(Array.isArray(dl))dl.forEach((x,i)=>{if(typeof x==="string")push("Download "+(i+1),x);else push(x.label||x.quality||x.type||("Download "+(i+1)),x.url||x.link,x.quality)});
  else if(typeof dl==="object"){
    push("Video HD (no watermark)",dl.play||dl.video_hd||dl.hd||dl.hdplay);
    push("Video",dl.video||dl.mp4||dl.videoUrl||dl.url);
    push("Video SD",dl.sd||dl.video_sd||dl.wmplay);
    push("Audio MP3",dl.audio||dl.mp3||dl.music||dl.audioUrl||dl.download_url);
    push("Audio M4A",dl.m4a);
    if(dl.medias)dl.medias.forEach(m=>push(m.label||m.quality||m.type,m.url,m.quality));
    if(dl.links)dl.links.forEach(l=>push(l.label||l.quality,l.url||l.link));
    if(dl.formats)dl.formats.forEach(f=>{const label=[f.quality||f.qualityLabel,f.ext||f.extension,f.hasAudio?"+audio":""].filter(Boolean).join(" ");push(f.label||label||"Format",f.url)})
  }
  Object.keys(res).forEach(k=>{
    if(["download","downloads","medias","data","formats","links"].includes(k))return;
    const v=res[k];
    if(typeof v==="string"&&/^https?:.*\.(mp4|mp3|m4a|webm|ogg)(\?|$)/i.test(v))push(k,v)
  });
  return out
}

// ═══════ COBALT (fallback utama semua platform) ═══════
async function cobalt(url){
  const endpoints=["https://api.cobalt.tools","https://co.wuk.sh","https://cobalt-api.kwiatekmiki.com"];
  let lastErr;
  for(const base of endpoints){
    try{
      const r=await ft(`${base}/api/json`,{
        method:"POST",
        headers:{"Accept":"application/json","Content-Type":"application/json","User-Agent":UA},
        body:JSON.stringify({url,videoQuality:"1080",tiktokFullAudio:!0,filenameStyle:"basic"})
      });
      if(!r.ok){lastErr=`HTTP ${r.status}`;continue}
      const d=await r.json();
      if(d.status==="error"){lastErr=d.error?.code||"cobalt error";continue}
      if(d.status==="rate-limit"){lastErr="rate limited";continue}
      if(!d.url){lastErr="no url";continue}
      return{ok:!0,platform:detect(url),url,title:"",author:"",thumbnail:"",duration:0,downloads:[
        {label:"Video 1080p",quality:"HD",url:d.url},
        ...(d.audio?[{label:"Audio MP3",quality:"",url:d.audio}]:[])
      ]}
    }catch(e){lastErr=String(e.message||e).slice(0,80)}
  }
  throw new Error("Cobalt: "+lastErr)
}

// ═══════ TIKWM (khusus TikTok) ═══════
async function tikwm(url){
  const r=await ft(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,{
    headers:{"User-Agent":UA,"Referer":"https://www.tikwm.com/","Accept":"application/json"}
  });
  if(!r.ok)throw new Error("tikwm HTTP "+r.status);
  const d=await r.json();
  if(d.code!==0||!d.data)throw new Error(d.msg||"tikwm empty");
  const v=d.data;
  return{ok:!0,platform:"tiktok",url,title:v.title||"",author:v.author?.unique_id||"",thumbnail:v.cover||"",duration:v.duration||0,downloads:[
    {label:"Video HD (no watermark)",quality:"HD",url:v.play},
    {label:"Video Full HD",quality:"FHD",url:v.hdplay},
    {label:"Video (watermark)",quality:"SD",url:v.wmplay},
    {label:"Audio MP3",quality:"audio",url:v.music}
  ].filter(x=>x.url)}
}

// ═══════ BTCH (YouTube/IG/FB/Spotify) ═══════
async function btch(platform,url){
  const r=await ft(`https://btch-downloader-api-green.vercel.app/api/download/${platform}?url=${encodeURIComponent(url)}`,{
    headers:{"User-Agent":UA,"Accept":"application/json"}
  });
  if(!r.ok)throw new Error(`btch HTTP ${r.status}`);
  const d=await r.json();
  if(!d||d.success===!1)throw new Error(d?.error?.message||"btch failed");
  return norm(platform,d.result||d.data||d,url)
}

// ═══════ VEVIOZ (YouTube MP3) ═══════
async function vevioz(url){
  const idM=url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  if(!idM)throw new Error("Video ID tidak ditemukan");
  const id=idM[1];
  const r=await ft(`https://api.vevioz.com/api/button/mp3/${id}`,{headers:{"User-Agent":UA}});
  if(!r.ok)throw new Error("vevioz HTTP "+r.status);
  const html=await r.text();
  const m=html.match(/href="(https?:\/\/[^"]*\.mp3[^"]*)"/)||html.match(/(https?:\/\/[^"\s]*\.mp3)/);
  if(!m)throw new Error("vevioz: no mp3 link");
  return{ok:!0,platform:"youtube",url,title:"",author:"",thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,duration:0,downloads:[
    {label:"Audio MP3",quality:"128kbps",url:m[1]},
    {label:"Thumbnail",quality:"image",url:`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
  ]}
}

// ═══════ YT-DLP MIRROR (YouTube) ═══════
async function ytdlp(url){
  const r=await ft(`https://api.cobalt.tools/api/json`,{
    method:"POST",
    headers:{"Accept":"application/json","Content-Type":"application/json","User-Agent":UA},
    body:JSON.stringify({url,videoQuality:"720",youtubeVideoCodec:"h264"})
  });
  if(!r.ok)throw new Error("cobalt yt HTTP "+r.status);
  const d=await r.json();
  if(d.status==="error"||!d.url)throw new Error(d.error?.code||"cobalt yt fail");
  return{ok:!0,platform:"youtube",url,title:"",author:"",thumbnail:"",duration:0,downloads:[
    {label:"Video 720p",quality:"HD",url:d.url},
    ...(d.audio?[{label:"Audio MP3",quality:"",url:d.audio}]:[])
  ]}
}

// ═══════ MULTI-PROVIDER CHAIN ═══════
async function runYoutube(url){
  const errors=[];
  // provider 1: btch
  try{const r=await btch("youtube",url);if(r.downloads.length)return r}catch(e){errors.push("btch:"+e.message)}
  // provider 2: cobalt
  try{const r=await cobalt(url);if(r.downloads.length)return r}catch(e){errors.push("cobalt:"+e.message)}
  // provider 3: ytdlp (cobalt variant)
  try{const r=await ytdlp(url);if(r.downloads.length)return r}catch(e){errors.push("ytdlp:"+e.message)}
  // provider 4: vevioz
  try{const r=await vevioz(url);if(r.downloads.length)return r}catch(e){errors.push("vevioz:"+e.message)}
  throw new Error("Semua provider YouTube gagal: "+errors.join(" | "))
}

async function runInstagram(url){
  const errors=[];
  try{const r=await btch("instagram",url);if(r.downloads.length)return r}catch(e){errors.push("btch:"+e.message)}
  try{const r=await cobalt(url);if(r.downloads.length)return r}catch(e){errors.push("cobalt:"+e.message)}
  throw new Error("Instagram gagal: "+errors.join(" | "))
}

async function runFacebook(url){
  const errors=[];
  try{const r=await btch("facebook",url);if(r.downloads.length)return r}catch(e){errors.push("btch:"+e.message)}
  try{const r=await cobalt(url);if(r.downloads.length)return r}catch(e){errors.push("cobalt:"+e.message)}
  throw new Error("Facebook gagal: "+errors.join(" | "))
}

async function runTiktok(url){
  const errors=[];
  try{const r=await tikwm(url);if(r.downloads.length)return r}catch(e){errors.push("tikwm:"+e.message)}
  try{const r=await cobalt(url);if(r.downloads.length)return r}catch(e){errors.push("cobalt:"+e.message)}
  try{const r=await btch("tiktok",url);if(r.downloads.length)return r}catch(e){errors.push("btch:"+e.message)}
  throw new Error("TikTok gagal: "+errors.join(" | "))
}

async function runSpotify(url){
  const errors=[];
  try{const r=await btch("spotify",url);if(r.downloads.length)return r}catch(e){errors.push("btch:"+e.message)}
  try{
    const r=await ft(`https://pika-spotify.vercel.app/download/?url=${encodeURIComponent(url)}`,{headers:{"User-Agent":UA}});
    if(r.ok){const d=await r.json();if(d.download_url)return{ok:!0,platform:"spotify",url,title:d.name||"",author:Array.isArray(d.artists)?d.artists.join(", "):(d.artists||""),thumbnail:d.image||"",duration:d.duration||0,downloads:[{label:"Audio MP3",quality:d.duration||"",url:d.download_url}]}}
  }catch(e){errors.push("pika:"+e.message)}
  throw new Error("Spotify gagal: "+errors.join(" | "))
}

export async function onRequest(context){
  const{request}=context;
  const u=new URL(request.url);
  const target=u.searchParams.get("url");
  const platform=u.searchParams.get("platform")||detect(target||"");
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-cache"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  if(!target)return new Response(JSON.stringify({ok:!1,error:"missing 'url'"}),{status:400,headers});
  try{
    let result;
    if(platform==="youtube")result=await runYoutube(target);
    else if(platform==="instagram")result=await runInstagram(target);
    else if(platform==="facebook")result=await runFacebook(target);
    else if(platform==="tiktok")result=await runTiktok(target);
    else if(platform==="spotify")result=await runSpotify(target);
    else if(platform==="melolo"||platform==="moviebox")throw new Error("Platform ini belum ada API publik gratis");
    else throw new Error(`Platform "${platform}" belum didukung`);
    if(!result.downloads||!result.downloads.length)throw new Error("Tidak ada link download ditemukan");
    return new Response(JSON.stringify(result),{status:200,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,300),platform,url:target}),{status:502,headers})
  }
}
