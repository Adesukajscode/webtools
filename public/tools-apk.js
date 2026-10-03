(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const kv=(k,v)=>`<div><span class="key">${esc(k)}</span>: <span class="val">${esc(v)}</span></div>`;
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
const ICON_APK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="9" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="15" y1="15" x2="15" y2="15"/></svg>';
const ICON_DL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
function extractPkg(input){if(!input)return null;try{const u=new URL(input);const p=u.searchParams.get("id");if(p)return p}catch(e){}if(/^[a-zA-Z][a-zA-Z0-9_.]{1,100}$/.test(input)&&input.includes("."))return input;return null}
function humanSize(b){if(!b||b<1024)return b+" B";if(b<1048576)return(b/1024).toFixed(1)+" KB";if(b<1073741824)return(b/1048576).toFixed(1)+" MB";return(b/1073741824).toFixed(2)+" GB"}
const TOOL={id:"apk",title:"APK Downloader",desc:"Download APK dari Google Play Store via APKPure — gratis, tanpa login",
html:`<div class="apk-banner">
<div class="apk-banner-icon">${ICON_APK}</div>
<div class="apk-banner-text"><strong>Download APK gratis</strong><br><span>Paste link Play Store atau package name. Support APK & XAPK (bundle).</span></div>
</div>
<div class="row" style="align-items:stretch">
<input type="text" id="apk-url" placeholder="https://play.google.com/store/apps/details?id=com.whatsapp" style="flex:1;margin:0">
<button class="btn primary" id="apk-fetch">${ICON_DL} Fetch APK</button>
</div>
<div class="dl-hint">Contoh: <code>com.whatsapp</code> · <code>com.instagram.android</code> · <code>org.telegram.messenger</code></div>
<div id="apk-preview" class="output center" style="display:none"></div>
<div id="apk-out" class="output"></div>`,
init(){
const input=$("apk-url"),btn=$("apk-fetch");
input.addEventListener("keydown",e=>{if(e.key==="Enter")btn.click()});
btn.addEventListener("click",async()=>{
const url=input.value.trim();
if(!url)return toast("Paste URL atau package name","error");
const pkg=extractPkg(url);
if(!pkg)return toast("Package name tidak valid","error");
out("apk-out",'<span class="dim">Mengambil metadata dari APKPure...</span>');
$("apk-preview").style.display="none";
btn.disabled=!0;btn.innerHTML='<span class="dim">Loading...</span>';
try{
const r=await fetch(`/api/apk?url=${encodeURIComponent(url)}`);
const ct=(r.headers.get("content-type")||"").toLowerCase();
if(ct.indexOf("json")===-1){const txt=await r.text();return out("apk-out",`<span class="err">Server balas non-JSON (HTTP ${r.status})</span>\n<span class="dim">${esc(txt.slice(0,200))}</span>`)}
const d=await r.json();
renderApk(d)}catch(e){out("apk-out",`<span class="err">Error: ${esc(e.message)}</span>`)}
finally{btn.disabled=!1;btn.innerHTML=ICON_DL+" Fetch APK"}})}};
function renderApk(d){
if(!d.ok){
let html=`<span class="err">Gagal: ${esc(d.error||"unknown")}</span>`;
if(d.fallback){html+='<div style="margin-top:14px;padding:10px 14px;background:var(--bg-3);border-radius:10px;font-size:12px">Metadata gagal, tapi link download tetap ada:</div>';
html+=`<div class="dl-item"><div class="dl-item-label">APK (universal)</div><a class="dl-item-btn" href="${esc(d.fallback.apk)}" target="_blank" rel="noopener">${ICON_DL} Download APK</a></div>`;
html+=`<div class="dl-item"><div class="dl-item-label">XAPK (bundle)</div><a class="dl-item-btn" href="${esc(d.fallback.xapk)}" target="_blank" rel="noopener">${ICON_DL} Download XAPK</a></div>`}
out("apk-out",html);return}
let html="";
html+=`<div class="dl-platform-badge" style="--pc:#01875f">APKPURE</div>`;
if(d.name)html+=kv("Nama",d.name);
if(d.package)html+=kv("Package",d.package);
if(d.version)html+=kv("Versi",d.version+(d.versionCode?" ("+d.versionCode+")":""));
if(d.developer)html+=kv("Developer",d.developer);
if(d.size)html+=kv("Ukuran",humanSize(d.size));
if(d.minAndroid)html+=kv("Min Android",d.minAndroid);
if(d.updated)html+=kv("Update terakhir",d.updated);
if(d.downloads)html+=kv("Total download",d.downloads);
if(d.whatsNew)html+=`<div style="margin-top:10px"><span class="key">Changelog</span>:<div class="dim" style="margin-top:4px;font-size:12px;line-height:1.5">${esc(d.whatsNew)}</div></div>`;
html+='<div style="margin-top:14px;padding:10px 14px;background:var(--bg-3);border-radius:10px;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--text-dim)">DOWNLOAD LINK</div>';
if(d.apk)html+=`<div class="dl-item"><div class="dl-item-label">${esc(d.apk.label)} <span class="dim">${esc(d.apk.type)}</span></div><a class="dl-item-btn" href="${esc(d.apk.url)}" target="_blank" rel="noopener">${ICON_DL} Download</a><div class="dl-item-url"><a href="${esc(d.apk.url)}" target="_blank" rel="noopener">${esc(d.apk.url)}</a></div></div>`;
if(d.xapk)html+=`<div class="dl-item"><div class="dl-item-label">${esc(d.xapk.label)} <span class="dim">${esc(d.xapk.type)}</span></div><a class="dl-item-btn" href="${esc(d.xapk.url)}" target="_blank" rel="noopener">${ICON_DL} Download</a><div class="dl-item-url"><a href="${esc(d.xapk.url)}" target="_blank" rel="noopener">${esc(d.xapk.url)}</a></div></div>`;
html+=`<div class="apk-note">ℹ️ <strong>Catatan:</strong> APK diambil dari <strong>APKPure</strong> (mirror Play Store), bukan langsung dari Google. Kadang ada delay beberapa hari dari versi resmi Play Store. Untuk app berbayar → tidak tersedia.</div>`;
out("apk-out",html);
if(d.icon){const p=$("apk-preview");p.style.display="block";p.innerHTML=`<img src="${esc(d.icon)}" alt="icon" style="max-width:96px;border-radius:20px;box-shadow:var(--shadow)" onerror="this.style.display='none'">`}
toast("Metadata diambil","success")}
function inject(){
if(window.TOOL_TITLES)window.TOOL_TITLES[TOOL.id]=TOOL.title;
const nav=$("nav");
if(nav&&!nav.querySelector(`button[data-tool="${TOOL.id}"]`)){
const b=document.createElement("button");b.dataset.tool=TOOL.id;
b.innerHTML=`<span class="nav-icon">${ICON_APK}</span> APK Downloader`;
const anchor=nav.querySelector('button[data-tool="dl"]');
if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)}
const ct=document.querySelector(".content");
if(ct&&!$("tool-"+TOOL.id)){
const s=document.createElement("section");s.id="tool-"+TOOL.id;s.className="tool";
s.innerHTML=`<div class="tool-head"><h2>${TOOL.title}</h2><p>${TOOL.desc}</p></div>${TOOL.html}`;
const anchor=ct.querySelector("#tool-dl");
if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)}
if(nav&&nav.dataset.apkx!=="1"){
nav.dataset.apkx="1";
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
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,250));else setTimeout(inject,250)})();
