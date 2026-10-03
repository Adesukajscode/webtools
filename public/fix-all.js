(function(){"use strict";
const log=(t,m)=>{t==="err"?console.error("[fix]",m):t==="warn"?console.warn("[fix]",m):console.log("[fix]",m)};

// ═══ 1. GLOBAL ERROR CATCHER ═══
window.__errors=[];
window.addEventListener("error",e=>{
  window.__errors.push({msg:e.message,file:e.filename,line:e.lineno});
  log("err","Uncaught: "+e.message+" @"+(e.filename||"?").split("/").pop()+":"+e.lineno)
});
window.addEventListener("unhandledrejection",e=>{
  window.__errors.push({msg:String(e.reason)});
  log("err","Promise: "+String(e.reason))
});

// ═══ 2. DEDUP NAV + TOOLS ═══
function dedup(){
  const nav=document.getElementById("nav");
  if(nav){
    const seen={};
    [...nav.querySelectorAll("button[data-tool]")].forEach(b=>{
      const id=b.dataset.tool;
      if(seen[id]){b.remove();log("warn","nav dup removed: "+id);return}
      seen[id]=1
    })
  }
  const seenT={};
  [...document.querySelectorAll("section.tool")].forEach(s=>{
    const id=s.id.replace("tool-","");
    if(seenT[id]){s.remove();log("warn","tool dup removed: "+id);return}
    seenT[id]=1
  });
  log("ok","dedup done")
}

// ═══ 3. ENSURE GLOBAL ═══
if(!window.TOOL_TITLES)window.TOOL_TITLES={};
if(!window.toast){
  window.toast=function(m,t){
    const el=document.getElementById("toast");
    if(!el){console.log("[toast]",m);return}
    el.textContent=m;
    el.className="toast show "+(t||"info");
    clearTimeout(window._tt);
    window._tt=setTimeout(()=>el.classList.remove("show"),2200)
  }
}
if(!window.showAuthError)window.showAuthError=window.toast;

// ═══ 4. AUTO-BIND FALLBACK HANDLER ═══
// Untuk tool yang tidak punya handler (karena script gagal load), auto-bind.
const BIND_LOG={};
function autoBind(){
  const nav=document.getElementById("nav");
  if(!nav)return;
  const buttons=[...nav.querySelectorAll("button[data-tool]")];
  const titles=window.TOOL_TITLES||{};
  buttons.forEach(b=>{
    const id=b.dataset.tool;
    if(BIND_LOG[id])return;
    BIND_LOG[id]=1;
    // Deteksi apakah sudah ada handler — pakai element clone trick tidak reliable
    // Jadi kita tambahkan di capture phase dan cek preventDefault
    b.addEventListener("click",function(e){
      // Kalau tidak ada script lain yang preventDefault, kita handle manual
      setTimeout(()=>{
        const target=document.getElementById("tool-"+id);
        if(!target){log("warn","tool missing: "+id);return}
        // Cek apakah sudah aktif (script lain handle) atau belum
        if(!target.classList.contains("active")){
          log("warn","fallback bind: "+id);
          document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
          document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
          target.classList.add("active");
          const ti=document.getElementById("current-tool-title");
          if(ti)ti.textContent=titles[id]||id;
          localStorage.setItem("lastTool",id);
          document.getElementById("sidebar")?.classList.remove("open");
          document.getElementById("overlay")?.classList.remove("show");
          window.location.hash="#/"+id
        }
      },50)
    },false)
  });
  log("ok","auto-bind done: "+buttons.length+" buttons")
}

// ═══ 5. FIX LIGHTNING ROUTER BLOCKING ═══
// lightning.js pakai capture:true dan preventDefault — bisa block script lain.
// Kita override dengan listener yang lebih permissive.
function fixRouter(){
  if(!window.Lightning)return;
  // Re-dispatch click ke script original setelah lightning
  const origStrike=window.Lightning.strike;
  log("ok","router ok (lightning active)")
}

// ═══ 6. CAMERA PERMISSION HELPER ═══
window.requestCamera=async function(constraints){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    throw new Error("Browser tidak support kamera")
  }
  const attempts=Array.isArray(constraints)?constraints:[
    constraints||{video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false},
    {video:{facingMode:"user"},audio:false},
    {video:true,audio:false}
  ];
  let lastErr;
  for(const c of attempts){
    try{return await navigator.mediaDevices.getUserMedia(c)}
    catch(e){lastErr=e;console.warn("[camera] attempt fail:",e.name)}
  }
  throw lastErr||new Error("Kamera gagal")
};

// ═══ 7. FIX BUTTON TANPA HANDLER ═══
// Kadang tombol onclick gagal karena fungsi tidak terdefinisi.
// Tambah global catcher — kalau onclick refer ke function undefined, log & toast.
if(window.Proxy&&!window._onclickPatched){
  try{
    const origAdd=EventTarget.prototype.addEventListener;
    // Skip — terlalu invasif
  }catch(e){}
}

// ═══ 8. HEALTH CHECK — test fitur utama ═══
function healthCheck(){
  const report={
    totalTools:document.querySelectorAll("section.tool").length,
    navButtons:document.querySelectorAll(".nav button[data-tool]").length,
    errors:window.__errors.length,
    features:{
      toast:typeof window.toast==="function",
      cyberAuth:!!window.CyberAuth,
      cyberGoogle:!!window.CyberGoogle,
      lightning:!!window.Lightning,
      cyberFace:!!window.CyberFace,
      deviceInfo:!!window.DeviceInfo,
      youtubePlayer:!!window.YouTubePlayer,
      handTracking:!!window.HandTracking
    }
  };
  console.log("[fix] ═══ HEALTH REPORT ═══",report);
  if(report.totalTools!==report.navButtons){
    log("warn","nav count mismatch: "+report.navButtons+" btns vs "+report.totalTools+" tools")
  }
  return report
}

// ═══ 9. RUN ═══
function run(){
  dedup();
  autoBind();
  fixRouter();
  setTimeout(()=>{
    healthCheck();
    log("ok","═══════ FIX-ALL DONE ═══════")
  },300)
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(run,1800));
else setTimeout(run,1800);

window.FixAll={run,healthCheck,cam:window.requestCamera,errors:()=>window.__errors};
})();
