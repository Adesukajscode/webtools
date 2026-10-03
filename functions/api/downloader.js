const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T=20000;
async function ft(u,o={},m=T){const c=new AbortController(),t=setTimeout(()=>c.abort(),m);try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}}
function detect(url){const u=url.toLowerCase();if(/youtube\.com|youtu\.be/.test(u))return"youtube";if(/instagram\.com/.test(u))return"instagram";if(/facebook\.com|fb\.watch/.test(u))return"facebook";if(/tiktok\.com/.test(u))return"tiktok";if(/spotify\.com/.test(u))return"spotify";if(/melolo/.test(u))return"melolo";if(/moviebox/.test(u))return"moviebox";return"unknown"}
async function btch(path,url){const r=await ft(`https://btch-downloader-api-green.vercel.app/api/download/${path}?url=${encodeURIComponent(url)}`,{headers:{"User-Agent":UA,"Accept":"application/json"}});if(!r.ok)throw new Error(`btch ${path} HTTP ${r.status}`);const d=await r.json();if(!d||d.success===!1)throw new Error(d?.error?.message||"btch failed");return d.result||d.data||d}
function norm(platform,res,url){const out={ok:!0,platform,url,title:res.title||res.desc||res.caption||res.name||"",author:res.author||res.username||res.channel||res.artists?.join?.(", ")||"",thumbnail:res.thumbnail||res.thumb||res.cover||res.image||"",duration:res.duration||0,downloads:[]};
const dl=res.download||res.downloads||res.medias||res.data||res;
const push=(label,u,q)=>{if(!u)return;const arr=Array.isArray(u)?u:[u];arr.forEach(x=>{const link=typeof x==="string"?x:(x.url||x.link||x.download_url);if(link&&/^https?:/.test(link))out.downloads.push({label,quality:q||"",url:link})})};
if(typeof dl==="string")push("Download",dl);
else if(Array.isArray(dl))dl.forEach((x,i)=>{if(typeof x==="string")push("Download "+(i+1),x);else{push(x.label||x.quality||x.type||("Download "+(i+1)),x.url||x.link,x.quality)}});
else if(typeof dl==="object"){push("Video",dl.video||dl.videoUrl||dl.mp4||dl.url,dl.quality);push("Video HD",dl.hd||dl.hdplay||dl.video_hd);push("Video SD",dl.sd||dl.video_sd);push("Audio MP3",dl.audio||dl.mp3||dl.music||dl.audioUrl||dl.download_url);push("Audio M4A",dl.m4a);push("Audio",dl.audios);if(dl.medias)dl.medias.forEach(m=>push(m.label||m.quality||m.type,m.url,m.quality));if(dl.links)dl.links.forEach(l=>push(l.label||l.quality,l.url||l.link))}
Object.keys(res).forEach(k=>{if(["download","downloads","medias","data"].includes(k))return;const v=res[k];if(typeof v==="string"&&/^https?:.*\.(mp4|mp3|m4a|webm|ogg)(\?|$)/i.test(v))push(k,v)});
return out}
async function youtube(url){const r=await btch("youtube",url);return norm("youtube",r,url)}
async function instagram(url){const r=await btch("instagram",url);return norm("instagram",r,url)}
async function facebook(url){const r=await btch("facebook",url);return norm("facebook",r,url)}
async function tiktok(url){const r=await ft(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,{headers:{"User-Agent":UA,"Referer":"https://www.tikwm.com/"}});if(!r.ok)throw new Error("tikwm "+r.status);const d=await r.json();if(d.code!==0||!d.data)throw new Error(d.msg||"tikwm empty");const v=d.data;return{ok:!0,platform:"tiktok",url,title:v.title||"",author:v.author?.unique_id||"",thumbnail:v.cover||"",duration:v.duration||0,downloads:[{label:"Video HD (no watermark)",url:v.play},{label:"Video Full HD",url:v.hdplay},{label:"Video (watermark)",url:v.wmplay},{label:"Audio MP3",url:v.music}].filter(x=>x.url)}}
async function spotify(url){
  // Provider 1: btch-downloader
  try{
    const r=await btch("spotify",url);
    const res=norm("spotify",r,url);
    if(res.downloads.length)return res
  }catch(e){console.warn("[spotify] btch failed:",e.message)}
  // Provider 2: pika-spotify fallback
  try{
    const r=await ft(`https://pika-spotify.vercel.app/download/?url=${encodeURIComponent(url)}`,{headers:{"User-Agent":UA,"Accept":"application/json"}});
    if(!r.ok)throw new Error("pika HTTP "+r.status);
    const d=await r.json();
    if(!d||!d.download_url)throw new Error("pika: no download_url");
    return{ok:!0,platform:"spotify",url,title:d.name||"",author:Array.isArray(d.artists)?d.artists.join(", "):(d.artists||""),thumbnail:d.image||"",duration:d.duration||0,downloads:[{label:"Audio MP3",quality:d.duration||"",url:d.download_url}]}
  }catch(e2){throw new Error("Spotify: semua provider gagal — "+e2.message)}
}
async function melolo(url){throw new Error("Melolo belum tersedia — tidak ada API publik")}
async function moviebox(url){throw new Error("MovieBox belum tersedia — butuh API khusus")}
export async function onRequest(context){const{request}=context;const u=new URL(request.url);const target=u.searchParams.get("url");const platform=u.searchParams.get("platform")||detect(target||"");
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-cache"};
if(request.method==="OPTIONS")return new Response("",{status:200,headers});
if(!target)return new Response(JSON.stringify({ok:!1,error:"missing 'url'"}),{status:400,headers});
try{let result;
if(platform==="youtube")result=await youtube(target);
else if(platform==="instagram")result=await instagram(target);
else if(platform==="facebook")result=await facebook(target);
else if(platform==="tiktok")result=await tiktok(target);
else if(platform==="spotify")result=await spotify(target);
else if(platform==="melolo")result=await melolo(target);
else if(platform==="moviebox")result=await moviebox(target);
else throw new Error(`Platform "${platform}" belum didukung`);
if(!result.downloads||!result.downloads.length)throw new Error("Tidak ada link download ditemukan");
return new Response(JSON.stringify(result),{status:200,headers})}catch(e){return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200),platform,url:target}),{status:502,headers})}}
