(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));

// ═══════════════════════════════════════════════════════
// SAFE WRAPPERS — setiap API dibungkus try/catch
// ═══════════════════════════════════════════════════════
const safe=async(fn,def="—")=>{try{const r=await fn();return r===null||r===undefined||r===""?def:r}catch(e){return def}};

// ═══ DETEKSI BROWSER & OS ═══
function detectBrowser(){
  const ua=navigator.userAgent;
  const tests=[
    ["Edg/",/Edg\/([\d.]+)/,"Edge"],
    ["OPR/",/OPR\/([\d.]+)/,"Opera"],
    ["Chrome/",/Chrome\/([\d.]+)/,"Chrome"],
    ["Firefox/",/Firefox\/([\d.]+)/,"Firefox"],
    ["Safari/",/Version\/([\d.]+).*Safari/,"Safari"]
  ];
  for(const[key,regex,name]of tests){
    if(ua.includes(key)){
      const m=ua.match(regex);
      if(m)return name+" "+m[1].split(".").slice(0,2).join(".");
      return name
    }
  }
  return "Unknown"
}

function detectOS(){
  const ua=navigator.userAgent;
  if(/Android/.test(ua)){const m=ua.match(/Android\s([\d.]+)/);return"Android "+(m?m[1]:"")}
  if(/iPhone|iPad|iPod/.test(ua)){const m=ua.match(/OS\s(\d+[_.]\d+)/);return"iOS "+(m?m[1].replace("_","."):"")}
  if(/Windows NT 10/.test(ua))return"Windows 10/11";
  if(/Windows NT/.test(ua))return"Windows";
  if(/Mac OS X/.test(ua)){const m=ua.match(/Mac OS X\s([\d_.]+)/);return"macOS "+(m?m[1].replace(/_/g,"."):"")}
  if(/CrOS/.test(ua))return"ChromeOS";
  if(/Linux/.test(ua))return"Linux";
  return"Unknown"
}

function detectDeviceType(){
  const ua=navigator.userAgent;
  const touch=navigator.maxTouchPoints||0;
  if(/iPad|Tablet/i.test(ua))return"📲 Tablet";
  if(/Mobile|Android|iPhone/i.test(ua))return"📱 Mobile";
  if(touch>1&&/Mac/.test(ua))return"💻 Mac (Touch)";
  return"💻 Desktop"
}

// ═══ WEBGL / GPU ═══
function getWebGL(){
  try{
    const c=document.createElement("canvas");
    const gl=c.getContext("webgl2")||c.getContext("webgl")||c.getContext("experimental-webgl");
    if(!gl)return null;
    const dbg=gl.getExtension("WEBGL_debug_renderer_info");
    const out={
      vendor:gl.getParameter(gl.VENDOR)||"—",
      renderer:gl.getParameter(gl.RENDERER)||"—",
      version:gl.getParameter(gl.VERSION)||"—",
      shading:gl.getParameter(gl.SHADING_LANGUAGE_VERSION)||"—",
      maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE)||"—",
      maxView:gl.getParameter(gl.MAX_VIEWPORT_DIMS)?Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)).join("×"):"—",
      webgl2:!!c.getContext("webgl2")
    };
    if(dbg){
      out.gpuVendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)||"—";
      out.gpuRenderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||"—"
    }
    return out
  }catch(e){return null}
}

// ═══ BATTERY — multi-fallback ═══
async function getBattery(){
  try{
    // Metode 1: standard Battery API
    if(navigator.getBattery){
      const b=await navigator.getBattery();
      return{
        level:Math.round(b.level*100)+"%",
        charging:b.charging?"⚡ Charging":"🔋 On battery",
        chargingTime:b.charging&&b.chargingTime!==Infinity?Math.round(b.chargingTime/60)+" min":"—",
        dischargingTime:!b.charging&&b.dischargingTime!==Infinity?Math.round(b.dischargingTime/60)+" min":"—"
      }
    }
    return{note:"Battery API tidak tersedia di browser ini"}
  }catch(e){
    return{note:"Battery API diblokir — "+e.message}
  }
}

// ═══ NETWORK ═══
function getNetwork(){
  try{
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const out={online:navigator.onLine?"✅ Online":"❌ Offline"};
    if(!c){out.note="Network API tidak tersedia";return out}
    out.effectiveType=c.effectiveType||"—";
    out.downlink=c.downlink?c.downlink+" Mbps":"—";
    out.rtt=c.rtt?c.rtt+" ms":"—";
    out.saveData=c.saveData?"ON":"OFF";
    out.type=c.type||"—";
    return out
  }catch(e){return{online:navigator.onLine?"✅ Online":"❌ Offline"}}
}

// ═══ STORAGE ═══
async function getStorage(){
  try{
    if(!navigator.storage||!navigator.storage.estimate)return{note:"Storage API tidak tersedia"};
    const e=await navigator.storage.estimate();
    const quotaGB=(e.quota||0)/1073741824;
    const usageMB=(e.usage||0)/1048576;
    return{
      quota:quotaGB.toFixed(2)+" GB",
      usage:usageMB.toFixed(2)+" MB",
      percent:e.quota?((e.usage/e.quota*100).toFixed(2)+"%"):"0%",
      persistent:navigator.storage.persisted?((await navigator.storage.persisted())?"✅":"❌"):"—"
    }
  }catch(e){return{note:"Storage API error: "+e.message}}
}

// ═══ MEDIA DEVICES ═══
async function getMedia(){
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return{note:"MediaDevices API tidak tersedia"};
    const d=await navigator.mediaDevices.enumerateDevices();
    const c={videoinput:0,audioinput:0,audiooutput:0};
    d.forEach(x=>{if(c[x.kind]!==undefined)c[x.kind]++});
    return{
      kamera:c.videoinput,
      mikrofon:c.audioinput,
      speaker:c.audiooutput,
      total:d.length
    }
  }catch(e){return{note:"Media enumeration gagal: "+e.message}}
}

// ═══ PUBLIC IP (free API) ═══
async function getPublicIP(){
  try{
    const r=await fetch("https://api.ipify.org?format=json",{signal:AbortSignal.timeout(5000)});
    const d=await r.json();
    return d.ip||"—"
  }catch(e){return"—"}
}

// ═══ CODECS ═══
function getCodecs(){
  const v=document.createElement("video");
  const a=document.createElement("audio");
  const list=[
    ["MP4","video/mp4"],["WebM","video/webm"],["Ogg","video/ogg"],
    ["H.264","video/mp4; codecs=\"avc1.42E01E\""],
    ["VP9","video/webm; codecs=\"vp9\""],
    ["AV1","video/mp4; codecs=\"av01.0.00M.08\""],
    ["MP3","audio/mpeg"],["AAC","audio/mp4"],
    ["Opus","audio/ogg; codecs=\"opus\""],
    ["FLAC","audio/flac"],["WAV","audio/wav"]
  ];
  const sup=[];
  list.forEach(([name,mime])=>{
    const type=mime.startsWith("audio")?a:v;
    if(type.canPlayType(mime)!=="")sup.push(name)
  });
  return sup.join(", ")||"—"
}

// ═══ FEATURES ═══
function getFeatures(){
  const f=[];
  if("geolocation" in navigator)f.push("Geolocation");
  if("serviceWorker" in navigator)f.push("Service Worker");
  if("Notification" in window)f.push("Notification");
  if(window.crypto&&window.crypto.subtle)f.push("WebCrypto");
  if("share" in navigator)f.push("Web Share");
  if("vibrate" in navigator)f.push("Vibration");
  if("bluetooth" in navigator)f.push("Bluetooth");
  if("usb" in navigator)f.push("WebUSB");
  if("credentials" in navigator)f.push("Credentials");
  if("wakeLock" in navigator)f.push("Wake Lock");
  if("clipboard" in navigator)f.push("Clipboard");
  if(window.indexedDB)f.push("IndexedDB");
  if("getBattery" in navigator)f.push("Battery");
  if("mediaDevices" in navigator)f.push("MediaDevices");
  if("connection" in navigator)f.push("Network Info");
  if(window.WebGL2RenderingContext)f.push("WebGL2");
  if("AudioContext" in window||"webkitAudioContext" in window)f.push("WebAudio");
  return f.join(", ")||"—"
}

// ═══ TIMEZONE + LOCALE ═══
function getLocale(){
  const out={};
  try{out.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"—"}catch(e){}
  try{out.locale=Intl.DateTimeFormat().resolvedOptions().locale||"—"}catch(e){}
  out.language=navigator.language||"—";
  out.languages=(navigator.languages||[]).join(", ")||"—";
  try{out.utcOffset=-new Date().getTimezoneOffset()/60+" jam"}catch(e){}
  return out
}

// ═══════════════════════════════════════════════════════
// COLLECT — kumpulkan semua
// ═══════════════════════════════════════════════════════
async function collect(){
  const gl=getWebGL();
  const loc=getLocale();
  const [battery,storage,media,ip]=await Promise.all([
    safe(()=>getBattery(),{note:"—"}),
    safe(()=>getStorage(),{note:"—"}),
    safe(()=>getMedia(),{note:"—"}),
    safe(()=>getPublicIP(),"—")
  ]);
  const net=getNetwork();
  const touch=navigator.maxTouchPoints||0;
  return{
    device:{
      type:detectDeviceType(),
      os:detectOS(),
      browser:detectBrowser(),
      platform:navigator.platform||"—",
      vendor:navigator.vendor||"—",
      publicIP:ip,
      language:loc.language,
      allLanguages:loc.languages,
      timezone:loc.timezone,
      locale:loc.locale,
      utcOffset:loc.utcOffset,
      cookies:navigator.cookieEnabled?"✅ Enabled":"❌ Disabled",
      dnt:navigator.doNotTrack==="1"?"ON":"OFF",
      ua:navigator.userAgent
    },
    hardware:{
      cpuCores:navigator.hardwareConcurrency?navigator.hardwareConcurrency+" cores":"—",
      deviceMemory:navigator.deviceMemory?navigator.deviceMemory+" GB (approx)":"—",
      touchPoints:touch+" titik",
      touchSupport:touch>0?"✅ Touchscreen":"❌ No touch",
      gpuVendor:gl?(gl.gpuVendor||gl.vendor):"—",
      gpuRenderer:gl?(gl.gpuRenderer||gl.renderer):"—",
      webglVersion:gl?gl.version:"—",
      shadingLang:gl?gl.shading:"—",
      maxTexture:gl?gl.maxTex+" px":"—",
      webgl2:gl?(gl.webgl2?"✅":"❌"):"—"
    },
    screen:{
      resolution:screen.width+" × "+screen.height,
      available:screen.availWidth+" × "+screen.availHeight,
      viewport:window.innerWidth+" × "+window.innerHeight,
      pixelRatio:(window.devicePixelRatio||1)+"x",
      physicalPixels:(screen.width*(window.devicePixelRatio||1))+" × "+(screen.height*(window.devicePixelRatio||1)),
      colorDepth:screen.colorDepth+" bit",
      pixelDepth:screen.pixelDepth+" bit",
      orientation:(screen.orientation&&screen.orientation.type)||"—",
      hdr:matchMedia("(dynamic-range: high)").matches?"✅ Support":"—",
      colorGamut:matchMedia("(color-gamut: p3)").matches?"P3":(matchMedia("(color-gamut: srgb)").matches?"sRGB":"—")
    },
    connectivity:net,
    battery:battery,
    storage:storage,
    media:media,
    codecs:getCodecs(),
    features:getFeatures()
  }
}

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════
const row=(k,v)=>`<div class="di-row"><span class="di-k">${esc(k)}</span><span class="di-v">${esc(String(v))}</span></div>`;
const group=(title,rows,icon)=>rows?`<div class="di-group"><div class="di-group-title">${icon||""} ${esc(title)}</div>${rows}</div>`:"";

function render(d){
  const D=d.device,H=d.hardware,S=d.screen,C=d.connectivity,B=d.battery,ST=d.storage,M=d.media;
  let h="";
  h+=`<div class="di-hero"><div class="di-hero-icon">${D.type.split(" ")[0]}</div><div class="di-hero-info"><div class="di-hero-title">${esc(D.os)}</div><div class="di-hero-sub">${esc(D.browser)} · ${esc(H.cpuCores)} · ${esc(D.timezone)}</div></div></div>`;
  h+=group("📱 Device & OS",[
    row("Tipe",D.type),row("OS",D.os),row("Browser",D.browser),row("Platform",D.platform),
    row("Vendor",D.vendor),row("IP Publik",D.publicIP),row("Bahasa",D.language),row("Semua Bahasa",D.allLanguages),
    row("Timezone",D.timezone),row("UTC Offset",D.utcOffset),row("Cookies",D.cookies),row("Do Not Track",D.dnt)
  ].join(""));
  h+=group("⚙️ Hardware",[
    row("CPU Cores",H.cpuCores),row("Device Memory",H.deviceMemory),row("Touch Support",H.touchSupport),
    row("Max Touch Points",H.touchPoints),row("GPU Vendor",H.gpuVendor),row("GPU Renderer",H.gpuRenderer),
    row("WebGL Version",H.webglVersion),row("WebGL2",H.webgl2),row("Shading Language",H.shadingLang),
    row("Max Texture Size",H.maxTexture)
  ].join(""));
  h+=group("🖥️ Layar",[
    row("Resolusi",S.resolution),row("Tersedia",S.available),row("Viewport",S.viewport),
    row("Pixel Ratio",S.pixelRatio),row("Physical Pixels",S.physicalPixels),row("Color Depth",S.colorDepth),
    row("Pixel Depth",S.pixelDepth),row("Orientasi",S.orientation),row("HDR",S.hdr),row("Color Gamut",S.colorGamut)
  ].join(""));
  h+=group("📶 Koneksi",Object.entries(C).map(([k,v])=>row(k,v)).join(""));
  h+=group("🔋 Baterai",Object.entries(B).map(([k,v])=>row(k,v)).join(""));
  h+=group("💾 Storage",Object.entries(ST).map(([k,v])=>row(k,v)).join(""));
  h+=group("📷 Media Devices",Object.entries(M).map(([k,v])=>row(k,v)).join(""));
  h+=group("🎵 Codec Support",row("Supported",d.codecs));
  h+=group("✨ Fitur Browser",row("Aktif",d.features));
  h+=group("🔍 User Agent",`<div class="di-ua">${esc(D.ua)}</div>`);
  h+=`<div class="di-actions"><button class="btn primary" id="di-copy">📋 Copy JSON</button><button class="btn" id="di-refresh">🔄 Refresh</button></div>`;
  return h
}

function bind(el,data){
  const cp=el.querySelector("#di-copy");
  if(cp)cp.onclick=()=>{
    const txt=JSON.stringify(data,null,2);
    if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toast("Info dicopy","success")).catch(()=>toast("Copy gagal","error"));
    else toast("Clipboard tidak tersedia","error")
  };
  const rf=el.querySelector("#di-refresh");
  if(rf)rf.onclick=async()=>{
    toast("Refreshing...","info");
    const fresh=await collect();
    el.querySelector(".di-panel-body,.di-inline-body").innerHTML=render(fresh);
    bind(el,fresh)
  }
}

// ═══════════════════════════════════════════════════════
// PANEL — muncul sekali setelah login
// ═══════════════════════════════════════════════════════
function buildPanel(data){
  const el=document.createElement("div");
  el.id="di-panel";el.className="di-panel";
  el.innerHTML=`<div class="di-panel-head"><div class="di-panel-title">📱 Spesifikasi Device Anda</div><button class="di-panel-close" id="di-close">✕</button></div><div class="di-panel-body">${render(data)}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("di-show"));
  $("di-close").addEventListener("click",()=>{el.classList.remove("di-show");setTimeout(()=>el.remove(),400)});
  bind(el,data);
}

// ═══════════════════════════════════════════════════════
// NAV + INLINE
// ═══════════════════════════════════════════════════════
function buildNav(){
  if($("tool-device"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="device"]')){
    const b=document.createElement("button");b.dataset.tool="device";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg></span> Device Info';
    const a=nav.querySelector('button[data-tool="apk"]')||nav.querySelector('button[data-tool="time"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-device")){
    const s=document.createElement("section");s.id="tool-device";s.className="tool";
    s.innerHTML='<div class="tool-head"><h2>Device Info</h2><p>Spesifikasi lengkap HP/browser Anda</p></div><div id="di-inline"><div class="dim" style="text-align:center;padding:20px">Buka tool ini untuk memuat data...</div></div>';
    const a=ct.querySelector("#tool-apk")||ct.querySelector("#tool-time");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.device="Device Info"
}

async function loadInline(){
  const el=$("di-inline");
  if(!el)return;
  if(el.dataset.loaded==="1")return;
  el.innerHTML='<div class="dim" style="text-align:center;padding:20px">📊 Mengumpulkan data...</div>';
  const data=await collect();
  el.innerHTML=`<div class="di-inline-body">${render(data)}</div>`;
  el.dataset.loaded="1";
  bind(el,data);
}

// ═══════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════
function boot(){
  if(!document.getElementById("tool-hash"))return;
  buildNav();
  // register init ke router
  if(window.registerTool){
    window.registerTool("device",()=>loadInline())
  }
  // Auto-show panel setelah login (sekali saja)
  const shown=localStorage.getItem("ct_device_shown_v2");
  const logged=localStorage.getItem("ct_auth");
  if(logged&&!shown){
    setTimeout(async()=>{
      try{
        const data=await collect();
        buildPanel(data);
        localStorage.setItem("ct_device_shown_v2","1");
        localStorage.removeItem("ct_device_shown") // hapus flag lama
      }catch(e){console.warn("[device] panel error:",e)}
    },2500)
  }
}

// Public API
window.DeviceInfo={
  collect,
  render,
  show:async()=>{const d=await collect();buildPanel(d)},
  clearShown:()=>{localStorage.removeItem("ct_device_shown_v2");toast("Panel akan muncul lagi setelah refresh","success")}
};

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,900));
else setTimeout(boot,900);
})();
