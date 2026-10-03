(function(){"use strict";
// ═══════════════════════════════════════════════════════
// TURNSTILE — captcha wrapper
// Sitekey test (selalu lolos): 1x00000000000000000000AA
// Ganti dengan sitekey asli Vex nanti
// ═══════════════════════════════════════════════════════
const SITEKEY="1x00000000000000000000AA"; // ← GANTI dengan sitekey dari dashboard Cloudflare
const SCRIPT="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loaded=!1,loading=null,widgetId=null,token=null,resolveFn=null;

function loadScript(){
  if(loaded)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src=SCRIPT;
    s.async=!0;s.defer=!0;
    s.onload=()=>{loaded=!0;res()};
    s.onerror=()=>rej(Error("Gagal load Turnstile"));
    document.head.appendChild(s)
  });
  return loading
}

async function render(container,opts){
  if(!container)return null;
  if(!window.turnstile||!window.turnstile.render){
    await loadScript();
    // tunggu turnstile siap
    await new Promise(res=>{
      let n=0;
      const t=setInterval(()=>{if(window.turnstile&&window.turnstile.render){clearInterval(t);res()}if(++n>50){clearInterval(t);res()}},100)
    })
  }
  if(!window.turnstile||!window.turnstile.render){
    console.warn("[turnstile] tidak tersedia");
    return null
  }
  // clear existing
  if(widgetId){try{window.turnstile.remove(widgetId)}catch(e){}widgetId=null}
  token=null;
  widgetId=window.turnstile.render(container,{
    sitekey:SITEKEY,
    theme:document.documentElement.getAttribute("data-theme")==="light"?"light":"dark",
    size:"normal",
    appearance:"always",
    callback:(t)=>{token=t;if(opts&&opts.onSuccess)opts.onSuccess(t)},
    "error-callback":()=>{token=null;if(opts&&opts.onError)opts.onError()},
    "expired-callback":()=>{token=null;if(opts&&opts.onExpired)opts.onExpired()},
    ...opts
  });
  return widgetId
}

function getToken(){return token}
function reset(){
  if(widgetId){try{window.turnstile.reset(widgetId)}catch(e){}}
  token=null
}
function remove(){
  if(widgetId){try{window.turnstile.remove(widgetId)}catch(e){}}
  widgetId=null;token=null
}
async function verify(serverUrl){
  if(!token)throw Error("Captcha belum selesai");
  const r=await fetch(serverUrl||"/api/verify-turnstile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
  const d=await r.json();
  if(!d.ok)throw Error(d.error||"Verifikasi gagal");
  return d
}

window.Turnstile={load:loadScript,render,getToken,reset,remove,verify,SITEKEY};
})();
