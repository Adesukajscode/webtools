(function(){"use strict";
const $=id=>document.getElementById(id);
const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ═══════════════════════════════════════════════════════
// LOADER — smooth ring pulse, no lightning
// ═══════════════════════════════════════════════════════
class Loader{
  constructor(){this.el=null;this.timer=null;this.on=!1}
  show(label){
    if(this.on)return;
    this.on=!0;
    if(!this.el){
      this.el=document.createElement("div");
      this.el.id="lt-overlay";
      this.el.className="lt-overlay";
      this.el.innerHTML=`<div class="lt-box"><div class="lt-rings"><div class="lt-ring"></div><div class="lt-ring lt-ring-2"></div><div class="lt-ring lt-ring-3"></div><div class="lt-core"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div></div><div class="lt-text" id="lt-text">Memuat...</div><div class="lt-progress"><div class="lt-progress-bar" id="lt-bar"></div></div><div class="lt-dots"><span></span><span></span><span></span></div></div>`;
      document.body.appendChild(this.el);
    }
    const t=$("lt-text");if(t)t.textContent=label||"Memuat...";
    const b=$("lt-bar");if(b)b.style.width="0%";
    document.body.classList.add("lt-active");
    requestAnimationFrame(()=>this.el.classList.add("lt-show"));
    // Fake progress
    let p=0;
    this.timer=setInterval(()=>{p+=Math.random()*15;if(p>90)p=90;const b=$("lt-bar");if(b)b.style.width=p+"%"},150);
  }
  async hide(){
    if(!this.on)return;
    clearInterval(this.timer);
    const b=$("lt-bar");if(b)b.style.width="100%";
    await new Promise(r=>setTimeout(r,250));
    this.el.classList.remove("lt-show");
    document.body.classList.remove("lt-active");
    await new Promise(r=>setTimeout(r,300));
    this.on=!1;
  }
}
const L=new Loader();

// Compatibility with existing code
window.Lightning={
  strike:async(label)=>{L.show(typeof label==="string"?label:"Memuat...")},
  end:()=>L.hide(),
  label:(t)=>{const e=$("lt-text");if(e)e.textContent=t},
  enable:!RM,
  getToken:()=>null
};

// ═══════════════════════════════════════════════════════
// ROUTER (unchanged)
// ═══════════════════════════════════════════════════════
const TOOLS_INIT=new Map();
const TOOLS_SHOWN=new Set();
let CURRENT=null,NAVIGATING=!1,FIRST=!0;

function getHash(){const h=location.hash.replace(/^#\/?/,"").trim();return h||null}
function setHash(id){const h="#/"+id;if(location.hash!==h)history.replaceState(null,"",h)}

window.registerTool=(id,fn)=>{if(typeof fn==="function")TOOLS_INIT.set(id,fn)};

async function navigate(id,fromHash){
  if(NAVIGATING)return;
  if(id===CURRENT&&!fromHash)return;
  const tg=$("tool-"+id);
  if(!tg){console.warn("[router] missing:",id);return}
  NAVIGATING=!0;
  const title=(window.TOOL_TITLES&&window.TOOL_TITLES[id])||id;
  if(!FIRST&&L.enable){await L.strike("Memuat "+title+"...")}
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.tool===id));
  document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
  tg.classList.add("active");
  const ti=$("current-tool-title");if(ti)ti.textContent=title;
  try{localStorage.setItem("lastTool",id)}catch(e){}
  $("sidebar")?.classList.remove("open");
  $("overlay")?.classList.remove("show");
  if(!TOOLS_SHOWN.has(id)){
    TOOLS_SHOWN.add(id);
    const fn=TOOLS_INIT.get(id);
    if(fn){try{await fn()}catch(e){console.error("[init "+id+"]",e)}}
    document.dispatchEvent(new CustomEvent("toolShow",{detail:{id}}));
  }
  CURRENT=id;setHash(id);
  if(!FIRST&&L.enable){await new Promise(r=>setTimeout(r,150));await L.hide()}
  FIRST=!1;NAVIGATING=!1;
  document.querySelector(".content")?.scrollTo({top:0,behavior:"smooth"})
}

document.addEventListener("click",(e)=>{
  const btn=e.target.closest(".nav button[data-tool]");
  if(!btn)return;
  const id=btn.dataset.tool;if(!id)return;
  if(e.defaultPrevented){e.preventDefault();return}
  e.preventDefault();
  navigate(id);
},false);

window.addEventListener("hashchange",()=>{if(NAVIGATING)return;const id=getHash();if(id&&id!==CURRENT)navigate(id,true)});

document.addEventListener("keydown",(e)=>{
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.isContentEditable)return;
  if(e.key!=="["&&e.key!=="]")return;
  const btns=[...document.querySelectorAll(".nav button[data-tool]")];
  const i=btns.findIndex(b=>b.dataset.tool===CURRENT);if(i<0)return;
  const nx=(i+(e.key==="]"?1:-1)+btns.length)%btns.length;
  navigate(btns[nx].dataset.tool)
});

function boot(){if(!document.getElementById("tool-hash"))return;const h=getHash();const saved=h||localStorage.getItem("lastTool")||"home";FIRST=!0;setTimeout(()=>navigate(saved,true),500)}
window.RouterNav={navigate,register:window.registerTool};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
