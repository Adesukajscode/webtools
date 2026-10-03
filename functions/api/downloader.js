const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const T=15000;
const ft=async(u,o={},m=T)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),m);try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}};
const det=u=>{u=(u||"").toLowerCase();return/youtube|youtu\.be/.test(u)?"youtube":/instagram/.test(u)?"instagram":/facebook|fb\.watch/.test(u)?"facebook":/tiktok/.test(u)?"tiktok":/spotify/.test(u)?"spotify":/twitter|x\.com/.test(u)?"twitter":"unknown"};

function mk(p,url,d={}){
  const o={ok:1,platform:p,url,title:d.title||"",author:d.author||"",thumb:d.thumb||"",duration:d.duration||0,downloads:[]};
  const seen=new Set();
  const add=(l,u,q)=>{if(!u)return;const arr=Array.isArray(u)?u:[u];arr.forEach(x=>{const link=typeof x==="string"?x:(x&&(x.url||x.link||x.download_url||x.downloadUrl||x.src));if(link&&/^https?:/i.test(link)&&!seen.has(link)){seen.add(link);o.downloads.push({label:String(l||"Link"),quality:String(q||""),url:String(link)})}})};
  if(d.dl){
    const dl=d.dl;
    if(typeof dl==="string")add("Download",dl);
    else if(Array.isArray(dl))dl.forEach((x,i)=>typeof x==="string"?add("Link "+(i+1),x):x&&add(x.label||x.quality||x.type||x.resolution||("Link "+(i+1)),x.url||x.link||x.download_url||x.src,x.quality||x.resolution));
    else if(typeof dl==="object"){
      add("Video HD",dl.play||dl.hd||dl.hdplay||dl.video_hd||dl.videoHD||dl.videoUrlHD);
      add("Video",dl.video||dl.mp4||dl.videoUrl||dl.video_url||dl.url||dl.playAddr||dl.noWatermark);
      add("Video SD",dl.sd||dl.video_sd||dl.wmplay||dl.low||dl.watermark);
      add("Audio MP3",dl.audio||dl.mp3||dl.music||dl.audioUrl||dl.audio_url||dl.download_url||dl.playUrl);
      add("Audio M4A",dl.m4a);
      ["medias","links","formats","videos"].forEach(k=>{if(Array.isArray(dl[k]))dl[k].forEach(m=>add(m.label||m.quality||m.type||m.resolution||m.format,m.url||m.link||m.download_url||m.src,m.quality||m.resolution||m.format))})
    }
  }
  if(d.scan){
    const walk=(o,dep=0)=>{if(dep>3||!o||typeof o!=="object")return;for(const k in o){if(["downloads","medias","data","result","formats","links"].includes(k))continue;const v=o[k];if(typeof v==="string"&&/^https?:.*\.(mp4|mp3|m4a|webm|mov|mkv)(\?|#|$)/i.test(v))add(k,v);else if(v&&typeof v==="object")walk(v,dep+1)}};
    walk(d.scan);
  }
  return o;
}

// ═══ COBALT — 8 MIRROR ═══
const COBALT=["https://api.cobalt.tools","https://co.wuk.sh","https://cobalt-api.kwiatekmiki.com","https://cobalt-api.meowing.de","https://cb.tynuk.eu.org","https://cobalt.255x.ru","https://api.cobalt.best","https://cobalt-backend.canine.tools"];
const cobalt=async(url,q="1080")=>{let e="";for(const b of COBALT){try{const r=await ft(b+"/api/json",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json","User-Agent":UA},body:JSON.stringify({url,videoQuality:q,tiktokFullAudio:!0,filenameStyle:"basic",youtubeVideoCodec:"h264"})});if(!r.ok){e="H"+r.status;continue}const d=await r.json();if(!d||d.status==="error"||!d.url){e=d?.error?.code||d?.status||"empty";continue}const dl=[];if(d.url)dl.push({label:"Video "+q,url:d.url,quality:q});if(d.audio)dl.push({label:"Audio MP3",url:d.audio});if(Array.isArray(d.picker))d.picker.forEach(p=>p.url&&dl.push({label:p.type||"Media",quality:p.quality||"",url:p.url}));if(dl.length)return mk(det(url),url,{dl})}catch(x){e=String(x.message||x).slice(0,50)}}throw Error("cobalt:"+e)};

// ═══ BTCH — 5 MIRROR ═══
const BTCH=["https://btch-downloader-api-green.vercel.app","https://api.btch-downloader.vercel.app","https://btch-api.vercel.app","https://btch-downloader.vercel.app","https://btch.vercel.app"];
const btch=async(p,url)=>{let e="";for(const b of BTCH){try{const r=await ft(`${b}/api/download/${p}?url=${encodeURIComponent(url)}`,{headers:{"User-Agent":UA,"Accept":"application/json"}});if(!r.ok){e="H"+r.status;continue}const d=await r.json();if(!d||d.success===!1){e=d?.error?.message||"fail";continue}const res=d.result||d.data||d;const n=mk(p,url,{dl:res,scan:res});if(n.downloads.length)return n}catch(x){e=String(x.message||x).slice(0,50)}}throw Error("btch:"+e)};

// ═══ TIKWM + TIKLYDOWN ═══
const tikwm=async url=>{const r=await ft("https://www.tikwm.com/api/?url="+encodeURIComponent(url)+"&hd=1",{headers:{"User-Agent":UA,"Referer":"https://www.tikwm.com/","Accept":"application/json"}});if(!r.ok)throw Error("H"+r.status);const d=await r.json();if(d.code!==0||!d.data)throw Error(d.msg||"empty");const v=d.data;return mk("tiktok",url,{title:v.title,author:v.author?.unique_id,thumb:v.cover,duration:v.duration,dl:{play:v.play,hdplay:v.hdplay,wmplay:v.wmplay,music:v.music,medias:[{label:"Video HD (no WM)",url:v.play,quality:"HD"},{label:"Video Full HD",url:v.hdplay,quality:"FHD"},{label:"Video (WM)",url:v.wmplay,quality:"SD"},{label:"Audio MP3",url:v.music,quality:"audio"}]}})};
const tiklydown=async url=>{const r=await ft("https://api.tiklydown.eu.org/api/download?url="+encodeURIComponent(url),{headers:{"User-Agent":UA,"Accept":"application/json"}});if(!r.ok)throw Error("H"+r.status);const d=await r.json();if(!d||!d.video)throw Error("empty");return mk("tiktok",url,{title:d.title,author:d.author?.unique_id,thumb:d.video.cover,duration:d.duration,dl:{playAddr:d.video.noWatermark,watermark:d.video.watermark,music:d.music?.playUrl}})};

// ═══ Y2MATE — 2 DOMAIN ═══
const y2mate=async url=>{const id=(url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/)||[])[1];if(!id)throw Error("no ID");let e="";for(const dom of["www.y2mate.com","y2mate.is"]){try{const r=await ft(`https://${dom}/mates/en948/analyze/ajax`,{method:"POST",headers:{"User-Agent":UA,"Content-Type":"application/x-www-form-urlencoded","X-Requested-With":"XMLHttpRequest","Referer":"https://"+dom+"/"},body:"url="+encodeURIComponent("https://www.youtube.com/watch?v="+id)+"&q_auto=0&ajax=1"});if(!r.ok){e="H"+r.status;continue}const d=await r.json();if(!d?.result){e="empty";continue}const html=d.result,links=[];const cln=s=>s.replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"');let m;const reV=/href="([^"]+)"[^>]*>[\s\S]{0,200}?(\d{3,4}p)/gi;while((m=reV.exec(html))!==null){const u=cln(m[1]);if(/\.mp4/.test(u)&&!links.find(x=>x.url===u))links.push({label:"Video "+m[2],url:u,quality:m[2]})}const reA=/href="([^"]+\.mp3[^"]*)"/gi;while((m=reA.exec(html))!==null){const u=cln(m[1]);if(!links.find(x=>x.url===u))links.push({label:"Audio MP3",url:u})}if(links.length)return mk("youtube",url,{thumb:"https://i.ytimg.com/vi/"+id+"/maxresdefault.jpg",dl:links})}catch(x){e=String(x.message||x).slice(0,50)}}throw Error("y2mate:"+e)};

// ═══ VEVIOZ — 2 FORMAT ═══
const vevioz=async url=>{const id=(url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/)||[])[1];if(!id)throw Error("no ID");for(const fmt of["mp3","mp4"]){try{const r=await ft(`https://api.vevioz.com/api/button/${fmt}/${id}`,{headers:{"User-Agent":UA}});if(!r.ok)continue;const t=await r.text();const m=t.match(/href="(https?:\/\/[^"]*\.(?:mp3|mp4)[^"]*)"/)||t.match(/(https?:\/\/[^"\s]+\.(?:mp3|mp4))/);if(m)return mk("youtube",url,{thumb:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",dl:[{label:"Audio "+fmt.toUpperCase(),url:m[1]}]})}catch(x){}}throw Error("vevioz fail")};

// ═══ SPOTIFY — 4 SOURCE ═══
const spotify=async url=>{const errors=[];
  try{const r=await btch("spotify",url);if(r.downloads.length)return r}catch(e){errors.push("btch")}
  try{const id=(url.match(/track\/([a-zA-Z0-9]+)/)||[])[1];if(id){const r=await ft("https://api.spotifydown.com/download/"+id,{headers:{"User-Agent":UA,"Accept":"application/json","Origin":"https://spotifydown.com","Referer":"https://spotifydown.com/"}});if(r.ok){const d=await r.json();if(d?.success&&d.link)return mk("spotify",url,{title:d.metadata?.title,author:d.metadata?.artists,thumb:d.metadata?.cover,duration:d.metadata?.duration,dl:[{label:"Audio MP3",url:d.link}]})}}}catch(e){errors.push("spotifydown")}
  try{const r=await ft("https://pika-spotify.vercel.app/download/?url="+encodeURIComponent(url),{headers:{"User-Agent":UA}});if(r.ok){const d=await r.json();if(d.download_url)return mk("spotify",url,{title:d.name,author:Array.isArray(d.artists)?d.artists.join(", "):d.artists,thumb:d.image,duration:d.duration,dl:[{label:"Audio MP3",url:d.download_url}]})}}catch(e){errors.push("pika")}
  try{const r=await cobalt(url,"320");if(r.downloads.length)return r}catch(e){errors.push("cobalt")}
  throw Error("Spotify: "+errors.join("/"))};

// ═══ ORCHESTRATORS ═══
const YT=[u=>btch("youtube",u),u=>y2mate(u),u=>cobalt(u,"1080"),u=>vevioz(u)];
const IG=[u=>btch("instagram",u),u=>cobalt(u,"1080")];
const FB=[u=>btch("facebook",u),u=>cobalt(u,"1080")];
const TT=[u=>tikwm(u),u=>tiklydown(u),u=>cobalt(u,"1080"),u=>btch("tiktok",u)];
const run=async(fns,url,label)=>{const errs=[];for(const f of fns){try{const r=await f(url);if(r.downloads.length)return r}catch(e){errs.push(String(e.message||e).slice(0,60))}}throw Error(label+" — "+errs.join(" | "))};

export async function onRequest(ctx){
  const{request}=ctx,u=new URL(request.url),target=u.searchParams.get("url"),platform=u.searchParams.get("platform")||det(target||"");
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-cache"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  if(!target)return new Response(JSON.stringify({ok:0,error:"missing url"}),{status:400,headers});
  try{
    const r=platform==="youtube"?await run(YT,target,"YouTube"):
            platform==="instagram"?await run(IG,target,"Instagram"):
            platform==="facebook"?await run(FB,target,"Facebook"):
            platform==="tiktok"?await run(TT,target,"TikTok"):
            platform==="spotify"?await spotify(target):
            null;
    if(!r)throw Error("Platform tidak didukung: "+platform);
    if(!r.downloads.length)throw Error("Tidak ada link download");
    return new Response(JSON.stringify(r),{status:200,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:0,error:String(e.message||e).slice(0,280),platform,url:target}),{status:502,headers})
  }
}
