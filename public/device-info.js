(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const row=(k,v)=>(v===null||v===undefined||v==="")?"":`<div class="di-row"><span class="di-k">${esc(k)}</span><span class="di-v">${esc(v)}</span></div>`;
const group=(title,html)=>{if(!html)return"";return`<div class="di-group"><div class="di-group-title">${esc(title)}</div>${html}</div>`};

function detectBrowser(){const ua=navigator.userAgent;let name="Unknown",ver="";const m=[["Edg/",'Edge'],["OPR/",'Opera'],["Chrome/",'Chrome'],["Firefox/",'Firefox'],["Safari/",'Safari']];for(const[k,n]of m){if(ua.includes(k)){name=n;const mm=ua.match(new RegExp(k+"([\\d.]+)"));if(mm)ver=mm[1];break}}return name+(ver?" "+ver.split(".").slice(0,2).join("."):"")}
function detectOS(){const ua=navigator.userAgent;if(/Android/.test(ua)){const m=ua.match(/Android\s([\d.]+)/);return"Android"+(m?" "+m[1]:"")}if(/iPhone|iPad|iPod/.test(ua)){const m=ua.match(/OS\s(\d+_\d+)/);return"iOS"+(m?" "+m[1].replace("_","."):"")}if(/Windows NT/.test(ua))return"Windows";if(/Mac OS X/.test(ua))return"macOS";if(/Linux/.test(ua))return"Linux";return"Unknown"}
function detectDeviceType(){const ua=navigator.userAgent;if(/Mobile|Android|iPhone/i.test(ua))return"📱 Mobile";if(/Tablet|iPad/i.test(ua))return"📲 Tablet";return"💻 Desktop"}

async function getWebGL(){try{const c=document.createElement("canvas");const gl=c.getContext("webgl")||c.getContext("experimental-webgl");if(!gl)return null;const dbg=gl.getExtension("WEBGL_debug_renderer_info");if(!dbg)return null;const vendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)||"";const renderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||"";const version=gl.getParameter(gl.VERSION)||"";return{vendor,renderer,version}}catch(e){return null}}

async function getBattery(){try{if(!navigator.getBattery)return null;const b=await navigator.getBattery();return{level:Math.round(b.level*100)+"%",charging:b.charging?"⚡ Charging":"🔋 Not charging",time:b.charging?(b.chargingTime?Math.round(b.chargingTime/60)+" min":"—"):(b.dischargingTime?Math.round(b.dischargingTime/60)+" min":"—")}}catch(e){return null}}

function getNetwork(){try{const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(!c)return null;return{type:c.effectiveType||c.type||"—",downlink:c.downlink?c.downlink+" Mbps":"—",rtt:c.rtt?c.rtt+" ms":"—",saveData:c.saveData?"ON (hemat)":"OFF"}}catch(e){return null}}

async function getStorage(){try{if(!navigator.storage||!navigator.storage.estimate)return null;const e=await navigator.storage.estimate();const q=(e.quota||0)/(1024*1024*1024);const u=(e.usage||0)/(1024*1024);return{quota:q.toFixed(2)+" GB",usage:u.toFixed(2)+" MB",percent:e.quota?((e.usage/e.quota*100).toFixed(2)+"%"):"0%"}}catch(e){return null}}

async function getMediaDevices(){try{if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return null;const d=await navigator.mediaDevices.enumerateDevices();const c={audioinput:0,audiooutput:0,videoinput:0};d.forEach(x=>{if(c[x.kind]!==undefined)c[x.kind]++});return{cameras:c.videoinput,microphones:c.audioinput,speakers:c.audiooutput}}catch(e){return null}}

function getCodecs(){const v=document.createElement("video");const a=document.createElement("audio");const test=(el,mime)=>el.canPlayType(mime)!=="";const list=["video/mp4","video/webm","video/ogg","audio/mpeg","audio/ogg","audio/wav","audio/mp4"];const sup=list.filter(m=>test(v,m)||test(a,m)).map(m=>m.split("/")[1]);return sup.join(", ")||"—"}

function getFeatures(){const f=[];if("geolocation" in navigator)f.push("Geolocation");if("serviceWorker" in navigator)f.push("Service Worker");if("Notification" in window)f.push("Notification");if(window.crypto&&window.crypto.subtle)f.push("Crypto");if("share" in navigator)f.push("Web Share");if("vibrate" in navigator)f.push("Vibration");if("bluetooth" in navigator)f.push("Bluetooth");if("usb" in navigator)f.push("USB");if("credentials" in navigator)f.push("Credentials");if("wakeLock" in navigator)f.push("Wake Lock");if("clipboard" in navigator)f.push("Clipboard");if(window.indexedDB)f.push("IndexedDB");return f.join(", ")||"—"}

function getTimezone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"Unknown"}catch(e){return"Unknown"}}

function getGPUInfo(){const c=document.createElement("canvas");let gpu="";try{const gl=c.getContext("webgl");if(gl){const dbg=gl.getExtension("WEBGL_debug_renderer_info");if(dbg)gpu=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||""}}catch(e){}return gpu}

async function collect(){
  const ua=navigator.userAgent;
  const gl=await getWebGL();
  const battery=await getBattery();
  const net=getNetwork();
  const storage=await getStorage();
  const media=await getMediaDevices();
  const touch=navigator.maxTouchPoints||0;
  return{
    device:{
      type:detectDeviceType(),
      os:detectOS(),
      browser:detectBrowser(),
      platform:navigator.platform||"—",
      userAgent:ua,
      vendor:navigator.vendor||"—",
      language:navigator.language||"—",
      languages:(navigator.languages||[]).join(", ")||"—",
      timezone:getTimezone(),
      cookies:navigator.cookieEnabled?"✅ Enabled":"❌ Disabled",
      doNotTrack:navigator.doNotTrack==="1"?"ON":"OFF"
    },
    hardware:{
      cpuCores:navigator.hardwareConcurrency?navigator.hardwareConcurrency+" cores":"—",
      deviceMemory:navigator.deviceMemory?navigator.deviceMemory+" GB (approx)":"—",
      maxTouchPoints:touch+" titik",
      touchSupport:touch>0?"✅ Touchscreen":"❌ No touch",
      gpuVendor:gl?gl.vendor:"—",
      gpuRenderer:gl?gl.renderer:"—",
      webglVersion:gl?gl.version:"—"
    },
    screen:{
      resolution:screen.width+" × "+screen.height,
      available:screen.availWidth+" × "+screen.availHeight,
      viewport:window.innerWidth+" × "+window.innerHeight,
      pixelRatio:window.devicePixelRatio+"x",
      colorDepth:screen.colorDepth+" bit",
      orientation:(screen.orientation&&screen.orientation.type)||"—",
      physicalPixels:(screen.width*window.devicePixelRatio)+" × "+(screen.height*window.devicePixelRatio)
    },
    connectivity:net?{
      effectiveType:net.type,
      downlink:net.downlink,
      rtt:net.rtt,
      saveData:net.saveData,
      online:navigator.onLine?"✅ Online":"❌ Offline"
    }:{online:navigator.onLine?"✅ Online":"❌ Offline"},
    battery:battery||{note:"Battery API tidak tersedia di browser ini"},
    storage:storage||{note:"Storage API tidak tersedia"},
    media:media||{note:"Media devices API tidak tersedia"},
    codecs:getCodecs(),
    features:getFeatures()
  }}

function render(data){
  let h="";
  h+=`<div class="di-hero"><div class="di-hero-icon">${data.device.type.split(" ")[0]}</div><div class="di-hero-info"><div class="di-hero-title">${esc(data.device.os)}</div><div class="di-hero-sub">${esc(data.device.browser)} · ${esc(data.hardware.cpuCores)} · ${esc(data.device.timezone)}</div></div></div>`;
  h+=group("📱 Device & OS",row("Tipe",data.device.type)+row("OS",data.device.os)+row("Browser",data.device.browser)+row("Platform",data.device.platform)+row("Vendor",data.device.vendor)+row("Bahasa",data.device.language)+row("Semua Bahasa",data.device.languages)+row("Timezone",data.device.timezone)+row("Cookies",data.device.cookies)+row("Do Not Track",data.device.doNotTrack));
  h+=group("⚙️ Hardware",row("CPU Cores",data.hardware.cpuCores)+row("Device Memory",data.hardware.deviceMemory)+row("Touch Support",data.hardware.touchSupport)+row("Max Touch Points",data.hardware.maxTouchPoints)+row("GPU Vendor",data.hardware.gpuVendor)+row("GPU Renderer",data.hardware.gpuRenderer)+row("WebGL Version",data.hardware.webglVersion));
  h+=group("🖥️ Layar",row("Resolusi",data.screen.resolution)+row("Tersedia",data.screen.available)+row("Viewport",data.screen.viewport)+row("Pixel Ratio",data.screen.pixelRatio)+row("Warna",data.screen.colorDepth)+row("Orientasi",data.screen.orientation)+row("Physical Pixels",data.screen.physicalPixels));
  h+=group("📶 Koneksi",Object.entries(data.connectivity).map(([k,v])=>row(k,v)).join(""));
  h+=group("🔋 Baterai",Object.entries(data.battery).map(([k,v])=>row(k,v)).join(""));
  h+=group("💾 Storage",Object.entries(data.storage).map(([k,v])=>row(k,v)).join(""));
  h+=group("📷 Media Devices",Object.entries(data.media).map(([k,v])=>row(k,v)).join(""));
  h+=group("🎵 Codec Support",row("Supported",data.codecs));
  h+=group("✨ Fitur Browser",row("Aktif",data.features));
  h+=group("🔍 Raw User Agent",`<div class="di-ua">${esc(data.device.userAgent)}</div>`);
  h+=`<div class="di-actions"><button class="btn primary" id="di-copy">📋 Copy semua info</button><button class="btn" id="di-refresh">🔄 Refresh</button></div>`;
  return h}

function buildPanel(data){
  const el=document.createElement("div");el.id="di-panel";el.className="di-panel";
  el.innerHTML=`<div class="di-panel-head"><div class="di-panel-title">📱 Spesifikasi Device Anda</div><button class="di-panel-close" id="di-close">✕</button></div><div class="di-panel-body">${render(data)}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("di-show"));
  $("di-close").addEventListener("click",()=>{el.classList.remove("di-show");setTimeout(()=>el.remove(),400)});
  $("di-copy").addEventListener("click",()=>{
    const txt=JSON.stringify(data,null,2);
    if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toast?.("Info ter-copy","success")).catch(()=>{});
  });
  $("di-refresh").addEventListener("click",async()=>{const fresh=await collect();el.querySelector(".di-panel-body").innerHTML=render(fresh);bindPanel(el,fresh);toast?.("Refreshed","success")});
  bindPanel(el,data);
}

function bindPanel(el,data){
  const btn=el.querySelector("#di-copy");
  if(btn)btn.onclick=()=>{const txt=JSON.stringify(data,null,2);if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>window.toast&&window.toast("Info ter-copy","success")).catch(()=>{})};
  const rf=el.querySelector("#di-refresh");
  if(rf)rf.onclick=async()=>{const f=await collect();el.querySelector(".di-panel-body").innerHTML=render(f);bindPanel(el,f)};
}

function attachNav(){
  const nav=$("nav");
  if(!nav||nav.querySelector('button[data-tool="device"]'))return;
  const b=document.createElement("button");b.dataset.tool="device";
  b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg></span> Device Info`;
  const anchor=nav.querySelector('button[data-tool="apk"]')||nav.querySelector('button[data-tool="time"]');
  if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b);
  const ct=document.querySelector(".content");
  if(ct&&!$("tool-device")){
    const s=document.createElement("section");s.id="tool-device";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>Device Info</h2><p>Spesifikasi detail HP/browser Anda</p></div><div id="di-inline"></div>`;
    if(anchor&&ct.querySelector("#tool-"+anchor.dataset.tool)){const tg=ct.querySelector("#tool-"+anchor.dataset.tool);if(tg.nextSibling)ct.insertBefore(s,tg.nextSibling);else ct.appendChild(s)}else ct.appendChild(s);
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.device="Device Info";
  nav.addEventListener("click",async e=>{
    const btn=e.target.closest('button[data-tool="device"]');
    if(!btn)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===btn));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-device");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Device Info";
    localStorage.setItem("lastTool","device");
    $("sidebar")&&$("sidebar").classList.remove("open");
    $("overlay")&&$("overlay").classList.remove("show");
    const inline=$("di-inline");
    if(inline&&!inline.dataset.loaded){inline.innerHTML='<div class="dim">Mendeteksi spesifikasi...</div>';const data=await collect();inline.innerHTML=render(data);inline.dataset.loaded="1";bindPanel(inline,data)}})
}

async function boot(){
  attachNav();
  // Cek apakah user baru login (belum pernah lihat spec)
  const shown=localStorage.getItem("ct_device_shown");
  const logged=localStorage.getItem("ct_auth");
  if(logged&&!shown){
    setTimeout(async()=>{
      const data=await collect();
      buildPanel(data);
      localStorage.setItem("ct_device_shown","1")},1800)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,300));else setTimeout(boot,300);
window.DeviceInfo={collect,render,show:async()=>{const d=await collect();buildPanel(d)}};
if(window.registerTool&&!window.__reg_device){window.__reg_device=1;window.registerTool("device",()=>{const t=document.querySelector('button[data-tool="device"]');if(t)t.click()})}
})();
