(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const kv=(k,v)=>`<div><span class="key">${esc(k)}</span>: <span class="val">${esc(v)}</span></div>`;
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
const ICON_DL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

function detect(url){const u=(url||"").toLowerCase();if(/youtube\.com|youtu\.be/.test(u))return"youtube";if(/instagram\.com/.test(u))return"instagram";if(/facebook\.com|fb\.watch/.test(u))return"facebook";if(/tiktok\.com/.test(u))return"tiktok";if(/spotify\.com/.test(u))return"spotify";if(/twitter\.com|x\.com/.test(u))return"twitter";return null}

const PLATFORMS=[
  {id:"youtube",name:"YouTube",color:"#ff0000"},
  {id:"instagram",name:"Instagram",color:"#e1306c"},
  {id:"facebook",name:"Facebook",color:"#1877f2"},
  {id:"tiktok",name:"TikTok",color:"#00f2ea"},
  {id:"spotify",name:"Spotify",color:"#1db954"},
  {id:"twitter",name:"Twitter/X",color:"#000"}
];

const HTML=`<div class="tool-head"><h2>🎵 Video & Music Downloader</h2><p>Download video & lagu dari YouTube, Instagram, Facebook, TikTok, Spotify, Twitter</p></div>
<div class="dl-notice">🌐 <strong>Multi-provider:</strong> Cobalt (8 mirror) + btch (5) + y2mate + vevioz + tikwm + tiklydown + spotifydown + pika. Auto-fallback kalau provider down.</div>
<div class="dl-platforms" id="dl-platforms">${PLATFORMS.map(p=>`<button class="dl-plat" data-plat="${p.id}" style="--pc:${p.color}"><span class="dl-plat-dot" style="background:${p.color}"></span>${p.name}</button>`).join("")}</div>
<div class="row" style="align-items:stretch">
  <input type="text" id="dl-url" placeholder="Paste URL video / lagu..." style="flex:1;margin:0">
  <button class="btn primary" id="dl-fetch">${ICON_DL} Fetch</button>
</div>
<div class="dl-hint" id="dl-hint">Auto-detect platform dari URL, atau pilih manual di atas</div>
<div id="dl-preview" class="output center" style="display:none"></div>
<div id="dl-out" class="output"></div>`;

let selectedPlatform=null,bound=!1;

function renderResult(d){
  let html="";
  const p=PLATFORMS.find(x=>x.id===d.platform)||{color:"var(--accent)",name:d.platform};
  html+=`<div class="dl-platform-badge" style="--pc:${p.color}">${esc(d.platform)}</div>`;
  if(d.title)html+=kv("Judul",String(d.title).slice(0,120));
  if(d.author)html+=kv("Artist/Author",d.author);
  if(d.duration)html+=kv("Durasi",d.duration+"s");
  if(d.downloads&&d.downloads.length){
    html+=`<div class="dl-section">DOWNLOAD LINK (${d.downloads.length})</div>`;
    d.downloads.forEach(l=>{
      const q=l.quality?` <span class="dim">${esc(l.quality)}</span>`:"";
      html+=`<div class="dl-item"><div class="dl-item-label">${esc(l.label)}${q}</div><a class="dl-item-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON_DL} Download</a><div class="dl-item-url"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(String(l.url).slice(0,90))}${l.url.length>90?"...":""}</a></div></div>`
    })
  }
  out("dl-out",html);
  if(d.thumbnail){const pv=$("dl-preview");pv.style.display="block";pv.innerHTML=`<img src="${esc(d.thumbnail)}" alt="thumb" style="max-width:280px;border-radius:12px" onerror="this.style.display='none'">`}
  toast("✅ Data diambil","success")
}

async function fetchNow(){
  const input=$("dl-url");if(!input)return;
  const url=input.value.trim();
  if(!url)return toast("Paste URL dulu","error");
  const platform=selectedPlatform||detect(url);
  if(!platform)return toast("Platform tidak dikenali","error");
  out("dl-out",'<span class="dim">Mengambil data dari '+platform+'...</span>');
  const pv=$("dl-preview");if(pv)pv.style.display="none";
  try{
    const r=await fetch(`/api/downloader?url=${encodeURIComponent(url)}&platform=${platform}`);
    const ct=(r.headers.get("content-type")||"").toLowerCase();
    if(ct.indexOf("json")===-1){const txt=await r.text();return out("dl-out",`<span class="err">Server balas non-JSON (HTTP ${r.status})</span>\n<span class="dim">${esc(txt.slice(0,200))}</span>`)}
    const d=await r.json();
    if(!d.ok)return out("dl-out",`<span class="err">Gagal: ${esc(d.error||"unknown")}</span>`);
    renderResult(d)
  }catch(e){out("dl-out",`<span class="err">Error: ${esc(e.message)}</span>`)}
}

function init(){
  if(bound)return;bound=!0;
  const input=$("dl-url"),hint=$("dl-hint"),btn=$("dl-fetch");
  if(!btn)return;
  document.querySelectorAll("#dl-platforms .dl-plat").forEach(b=>{
    b.addEventListener("click",()=>{
      const p=b.dataset.plat;
      if(selectedPlatform===p){selectedPlatform=null;b.classList.remove("active");if(hint)hint.textContent="Auto-detect platform dari URL, atau pilih manual di atas";return}
      selectedPlatform=p;document.querySelectorAll("#dl-platforms .dl-plat").forEach(x=>x.classList.remove("active"));b.classList.add("active");
      if(hint)hint.textContent=`Platform: ${b.textContent.trim()} (manual)`
    })
  });
  if(input)input.addEventListener("input",()=>{
    const d=detect(input.value.trim());
    if(d&&!selectedPlatform&&hint)hint.textContent=`Terdeteksi: ${d}`;
    else if(!selectedPlatform&&hint)hint.textContent="Auto-detect platform dari URL, atau pilih manual di atas"
  });
  if(input)input.addEventListener("keydown",e=>{if(e.key==="Enter")fetchNow()});
  btn.addEventListener("click",fetchNow)
}

function build(){
  if($("tool-dl"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="dl"]')){
    const b=document.createElement("button");b.dataset.tool="dl";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> Video Downloader';
    const a=nav.querySelector('button[data-tool="tiktok"]')||nav.querySelector('button[data-tool="youtube"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-dl")){
    const s=document.createElement("section");s.id="tool-dl";s.className="tool";s.innerHTML=HTML;
    const a=ct.querySelector("#tool-tiktok")||ct.querySelector("#tool-hash");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.dl="Video Downloader";
  init()
}

if(window.registerTool)window.registerTool("dl",()=>init());
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,700));else setTimeout(build,700);
})();
