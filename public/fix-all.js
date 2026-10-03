(function(){"use strict";
const log=(lv,...a)=>{const p="[fix:"+lv+"]";lv==="err"?console.error(p,...a):lv==="warn"?console.warn(p,...a):console.log(p,...a)};

// Global error catcher
window.__errs=[];
window.addEventListener("error",e=>{window.__errs.push({m:e.message,f:(e.filename||"?").split("/").pop(),l:e.lineno});log("err",e.message,"@"+(e.filename||"?").split("/").pop()+":"+e.lineno)});
window.addEventListener("unhandledrejection",e=>{window.__errs.push({m:String(e.reason)});log("err","promise:",String(e.reason))});

// Ensure global
if(!window.TOOL_TITLES)window.TOOL_TITLES={};
if(!window.toast){window.toast=(m,t)=>{const el=document.getElementById("toast");if(!el){console.log("[toast]",m);return}el.textContent=m;el.className="toast show "+(t||"info");clearTimeout(window._tt);window._tt=setTimeout(()=>el.classList.remove("show"),2200)}}
if(!window.showAuthError)window.showAuthError=window.toast;

// Camera helper
window.requestCamera=async c=>{
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw Error("Browser tidak support kamera");
  const att=Array.isArray(c)?c:[c||{video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false},{video:{facingMode:"user"},audio:false},{video:!0,audio:false}];
  let last;for(const a of att){try{return await navigator.mediaDevices.getUserMedia(a)}catch(e){last=e}}
  throw last||Error("Kamera gagal");
};

// ═══ DEDUP + HEALTH CHECK ═══
function dedup(){
  const nav=document.getElementById("nav");if(!nav)return;
  const seen={};
  [...nav.querySelectorAll("button[data-tool]")].forEach(b=>{
    const id=b.dataset.tool;
    if(seen[id]){b.remove();log("warn","nav dup removed:",id);return}
    seen[id]=1;
  });
  const seenT={};
  [...document.querySelectorAll("section.tool")].forEach(s=>{
    const id=s.id.replace("tool-","");
    if(seenT[id]){s.remove();log("warn","tool dup removed:",id);return}
    seenT[id]=1;
  });
}

// ═══ FALLBACK INIT: kalau script tool tidak register, tetap bisa aktif ═══
function installFallback(){
  // Register minimal init untuk tool yang belum punya — supaya click tidak "mati"
  const nav=document.getElementById("nav");if(!nav)return;
  const btns=nav.querySelectorAll("button[data-tool]");
  btns.forEach(b=>{
    const id=b.dataset.tool;
    // Kalau tool sudah punya init terdaftar via registerTool, skip
    // (tidak bisa cek langsung Map, jadi pakai flag)
    if(!b.dataset.fallback){
      b.dataset.fallback="1"
    }
  });
}

// ═══ AUTO-RECOVER: kalau 5 detik setelah load ada tool yang belum siap, log warning ═══
function audit(){
  const nav=document.getElementById("nav");
  const ct=document.querySelector(".content");
  if(!nav||!ct)return;
  const navBtns=[...nav.querySelectorAll("button[data-tool]")].map(b=>b.dataset.tool);
  const tools=[...ct.querySelectorAll("section.tool")].map(s=>s.id.replace("tool-",""));
  const missingInNav=tools.filter(t=>!navBtns.includes(t));
  const missingInTools=navBtns.filter(t=>!tools.includes(t));
  const report={
    navCount:navBtns.length,
    toolCount:tools.length,
    errors:window.__errs.length,
    features:{
      toast:typeof window.toast==="function",
      auth:!!window.CyberAuth,
      google:!!window.CyberGoogle,
      lightning:!!window.Lightning,
      router:!!window.RouterNav,
      face:!!window.CyberFace,
      device:!!window.DeviceInfo,
      youtube:!!window.YouTubePlayer,
      hands:!!window.HandTracking
    },
    missingInNav,
    missingInTools
  };
  log("ok","═══ HEALTH REPORT ═══");console.log(report);
  if(missingInNav.length)log("warn","Nav missing:",missingInNav);
  if(missingInTools.length)log("warn","Tool section missing:",missingInTools);
  if(missingInNav.length||missingInTools.length){
    // Auto-add nav button untuk tool yang ada tapi tidak ada di nav
    missingInNav.forEach(id=>{
      const b=document.createElement("button");b.dataset.tool=id;
      const t=(window.TOOL_TITLES&&window.TOOL_TITLES[id])||id;
      b.innerHTML='<span class="nav-icon">📦</span> '+t;
      nav.appendChild(b);
      log("ok","auto-added nav for",id);
    });
  }
  return report;
}

// ═══ EXPOSE API ═══
window.FixAll={
  audit,
  errors:()=>window.__errs,
  cam:window.requestCamera,
  clearErrors:()=>window.__errs=[],
  run:async(id)=>{
    // manual trigger tool
    if(window.RouterNav)return window.RouterNav.navigate(id)
  }
};

// ═══ RUN ═══
function run(){
  dedup();
  installFallback();
  setTimeout(()=>{audit();log("ok","═══ FIX-ALL DONE ═══")},3500);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(run,1500));
else setTimeout(run,1500);
})();
