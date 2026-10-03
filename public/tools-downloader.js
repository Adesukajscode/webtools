(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const kv=(k,v)=>`<div><span class="key">${esc(k)}</span>: <span class="val">${esc(v)}</span></div>`;
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
const ICON_DL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
function detectPlatform(url){const u=(url||"").toLowerCase();if(/youtube\.com|youtu\.be/.test(u))return"youtube";if(/instagram\.com/.test(u))return"instagram";if(/facebook\.com|fb\.watch/.test(u))return"facebook";if(/tiktok\.com/.test(u))return"tiktok";if(/spotify\.com/.test(u))return"spotify";if(/melolo/.test(u))return"melolo";if(/moviebox/.test(u))return"moviebox";return null}
const PLATFORMS=[{id:"youtube",name:"YouTube",color:"#ff0000"},{id:"instagram",name:"Instagram",color:"#e1306c"},{id:"facebook",name:"Facebook",color:"#1877f2"},{id:"tiktok",name:"TikTok",color:"#00f2ea"},{id:"spotify",name:"Spotify",color:"#1db954"},{id:"melolo",name:"Melolo",color:"#8b5cf6"},{id:"moviebox",name:"MovieBox",color:"#f59e0b"}];
const TOOL={id:"dl",title:"Video Downloader",desc:"Download video & lagu dari YouTube, Instagram, Facebook, TikTok, Spotify, Melolo, MovieBox",
html:`<div class="dl-platforms" id="dl-platforms">${PLATFORMS.map(p=>`<button class="dl-plat" data-plat="${p.id}" style="--pc:${p.color}"><span class="dl-plat-dot" style="background:${p.color}"></span>${p.name}</button>`).join("")}</div>
<div class="row" style="align-items:stretch">
<input type="text" id="dl-url" placeholder="Paste URL video / lagu..." style="flex:1;margin:0">
<button class="btn primary" id="dl-fetch">${ICON_DL} Fetch</button>
</div>
<div class="dl-hint" id="dl-hint">Auto-detect platform dari URL, atau pilih manual di atas</div>
<div id="dl-preview" class="output center" style="display:none"></div>
<div id="dl-out" class="output"></div>`,
init(){
let selectedPlatform=null;
const input=$("dl-url"),hint=$("dl-hint");
document.querySelectorAll(".dl-plat").forEach(b=>{
b.addEventListener("click",()=>{
const p=b.dataset.plat;
if(selectedPlatform===p){selectedPlatform=null;b.classList.remove("active");hint.textContent="Auto-detect platform dari URL, atau pilih manual di atas";return}
selectedPlatform=p;document.querySelectorAll(".dl-plat").forEach(x=>x.classList.remove("active"));b.classList.add("active");hint.textContent=`Platform: ${b.textContent.trim()} (manual)`})});
input.addEventListener("input",()=>{
const d=detectPlatform(input.value.trim());
if(d&&!selectedPlatform)hint.textContent=`Terdeteksi: ${d}`;
else if(!selectedPlatform)hint.textContent="Auto-detect platform dari URL, atau pilih manual di atas"});
$("dl-fetch").addEventListener("click",async()=>{
const url=input.value.trim();
if(!url)return toast("Paste URL dulu","error");
const platform=selectedPlatform||detectPlatform(url);
if(!platform)return toast("Platform tidak dikenali","error");
out("dl-out",'<span class="dim">Mengambil data dari '+platform+'...</span>');
$("dl-preview").style.display="none";
try{
const r=await fetch(`/api/downloader?url=${encodeURIComponent(url)}&platform=${platform}`);
const ct=(r.headers.get("content-type")||"").toLowerCase();
if(ct.indexOf("json")===-1){const txt=await r.text();return out("dl-out",`<span class="err">Server balas non-JSON (HTTP ${r.status}).</span>\n<span class="dim">${esc(txt.slice(0,200))}</span>`)}
const d=await r.json();
if(!d.ok)return out("dl-out",`<span class="err">Gagal: ${esc(d.error||"unknown")}</span>`);
renderResult(d);
}catch(e){out("dl-out",`<span class="err">Error: ${esc(e.message)}</span>`)}})}};
function renderResult(d){
let html="";
html+=`<div class="dl-platform-badge" style="--pc:${(PLATFORMS.find(p=>p.id===d.platform)||{}).color||"var(--accent)"}">${esc(d.platform)}</div>`;
if(d.title)html+=kv("Judul",d.title.slice(0,120));
if(d.author)html+=kv("Artist",d.author);
if(d.duration)html+=kv("Durasi",d.duration+"s");
if(d.downloads&&d.downloads.length){
html+='<div style="margin-top:14px;padding:10px 14px;background:var(--bg-3);border-radius:10px;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--text-dim)">DOWNLOAD LINK ('+d.downloads.length+')</div>';
d.downloads.forEach((l,i)=>{
const quality=l.quality?` <span class="dim">${esc(l.quality)}</span>`:"";
html+=`<div class="dl-item"><div class="dl-item-label">${esc(l.label)}${quality}</div><a class="dl-item-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON_DL} Download</a><div class="dl-item-url"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url.slice(0,80))}${l.url.length>80?"...":""}</a></div></div>`})}
out("dl-out",html);
if(d.thumbnail){const p=$("dl-preview");p.style.display="block";p.innerHTML=`<img src="${esc(d.thumbnail)}" alt="thumb" style="max-width:280px;border-radius:12px" onerror="this.style.display='none'">`}
toast("Data diambil","success")}
function inject(){
if(window.TOOL_TITLES)window.TOOL_TITLES[TOOL.id]=TOOL.title;
const nav=$("nav");
if(nav&&!nav.querySelector(`button[data-tool="${TOOL.id}"]`)){
const b=document.createElement("button");b.dataset.tool=TOOL.id;
b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> Video Downloader`;
const anchor=nav.querySelector('button[data-tool="tiktok"]');
if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)}
const ct=document.querySelector(".content");
if(ct&&!$("tool-"+TOOL.id)){
const s=document.createElement("section");s.id="tool-"+TOOL.id;s.className="tool";
s.innerHTML=`<div class="tool-head"><h2>${TOOL.title}</h2><p>${TOOL.desc}</p></div>${TOOL.html}`;
const anchor=ct.querySelector("#tool-tiktok");
if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)}
if(nav&&nav.dataset.dlx!=="1"){
nav.dataset.dlx="1";
nav.addEventListener("click",e=>{
const b=e.target.closest("button[data-tool]");if(!b)return;
if(b.dataset.tool!==TOOL.id)return;
document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
const tg=$("tool-"+TOOL.id);if(tg)tg.classList.add("active");
const ti=$("current-tool-title");if(ti)ti.textContent=TOOL.title;
localStorage.setItem("lastTool",TOOL.id);
$("sidebar")&&$("sidebar").classList.remove("open");
$("overlay")&&$("overlay").classList.remove("show");
if(tg&&!tg.dataset.inited){try{TOOL.init();tg.dataset.inited="1"}catch(e){console.warn(e)}}})}
if(typeof window.applyIcons==="function")window.applyIcons()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,200));else setTimeout(inject,200)})();
