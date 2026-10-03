(function(){"use strict";
const $=id=>document.getElementById(id);
const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PERF={fps:0,frames:0,last:0,quality:"high",monitor(){this.frames++;const n=performance.now();if(n-this.last>=1000){this.fps=this.frames;this.frames=0;this.last=n;if(this.fps<45)this.quality="low";else if(this.fps>55&&this.quality==="low")this.quality="high"}},get sparkN(){return this.quality==="low"?14:26},get blur(){return this.quality==="low"?8:20}};

class LT{
  constructor(){this.c=null;this.x=null;this.w=0;this.h=0;this.dpr=1;this.bolts=[];this.sparks=[];this.flash=0;this.run=!1;this.raf=null;this.last=0;this.snd=null;this.enable=!RM;this._bind()}
  _bind(){window.addEventListener("resize",()=>this._resize(),{passive:!0});document.addEventListener("visibilitychange",()=>{if(document.hidden)this._stop();})}
  overlay(){let e=$("lt-overlay");if(e){this.c=$("lt-canvas");this.x=this.c.getContext("2d",{alpha:!0,desynchronized:!0});this._resize();return e}
    e=document.createElement("div");e.id="lt-overlay";e.className="lt-overlay";
    e.innerHTML='<canvas id="lt-canvas"></canvas><div class="lt-flash" id="lt-flash"></div><div class="lt-label"><div class="lt-icon">⚡</div><div class="lt-text">Memuat...</div></div>';
    document.body.appendChild(e);this.c=$("lt-canvas");this.x=this.c.getContext("2d",{alpha:!0,desynchronized:!0});this._resize();return e}
  _resize(){this.dpr=Math.min(window.devicePixelRatio||1,2);this.w=window.innerWidth;this.h=window.innerHeight;if(this.c){this.c.width=this.w*this.dpr;this.c.height=this.h*this.dpr;this.c.style.width=this.w+"px";this.c.style.height=this.h+"px";this.x.setTransform(this.dpr,0,0,this.dpr,0,0)}}
  _bolt(x1,y1,x2,y2,maxD){const p=[{x:x1,y:y1}],st=[{x1,y1,x2,y2,d:0}];while(st.length){const it=st.pop();if(it.d>=maxD){p.push({x:it.x2,y:it.y2});continue}const ds=Math.hypot(it.x2-it.x1,it.y2-it.y1),dp=ds*(0.14+Math.random()*0.14)*(1-it.d/maxD),mx=(it.x1+it.x2)/2+(Math.random()-.5)*dp,my=(it.y1+it.y2)/2+(Math.random()-.5)*dp*.35;st.push({x1:mx,y1:my,x2:it.x2,y2:it.y2,d:it.d+1});st.push({x1:it.x1,y1:it.y1,x2:mx,y2:my,d:it.d+1})}p.sort((a,b)=>Math.hypot(a.x-x1,a.y-y1)-Math.hypot(b.x-x1,b.y-y1));return p}
  _strike(){const sx=this.w*(0.15+Math.random()*0.7),ex=sx+(Math.random()-.5)*this.w*0.55,ey=this.h*(0.55+Math.random()*0.45);const main=this._bolt(sx,-20,ex,ey,6);const br=[];for(let i=4;i<main.length-2;i++){if(Math.random()<0.3){const p=main[i],ag=Math.PI/2+(Math.random()-.5)*1.6,ln=60+Math.random()*160;br.push(this._bolt(p.x,p.y,p.x+Math.cos(ag)*ln,p.y+Math.abs(Math.sin(ag))*ln*.6,4))}}this.bolts.push({main,br,born:performance.now(),life:420,w:2+Math.random()*1.8,hue:200+Math.random()*45});const ep=main[main.length-1],sn=PERF.sparkN;for(let i=0;i<sn;i++){const a=Math.random()*Math.PI*2,sp=2+Math.random()*8;this.sparks.push({x:ep.x,y:ep.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,size:1+Math.random()*2,hue:200+Math.random()*50})}this.flash=0.55+Math.random()*0.25}
  _thunder(){if(!this.snd)return;try{if(!this.sndCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.sndCtx=new AC()}const c=this.sndCtx,d=1.1,sr=c.sampleRate,b=c.createBuffer(1,sr*d,sr),dt=b.getChannelData(0);for(let i=0;i<dt.length;i++){const t=i/sr;dt[i]=(Math.random()*2-1)*Math.exp(-t*2.2)*(1-Math.exp(-t*32))}const s=c.createBufferSource();s.buffer=b;const f=c.createBiquadFilter();f.type="lowpass";f.frequency.setValueAtTime(420,c.currentTime);f.frequency.exponentialRampToValueAtTime(70,c.currentTime+d);const g=c.createGain();g.gain.setValueAtTime(0.12,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d);s.connect(f);f.connect(g);g.connect(c.destination);s.start()}catch(e){}}
  _loop(){if(!this.run)return;const n=performance.now();if(!this.last)this.last=n;let dt=n-this.last;this.last=n;if(dt>100)dt=100;PERF.monitor();this.x.clearRect(0,0,this.w,this.h);
    for(let i=this.bolts.length-1;i>=0;i--){const b=this.bolts[i],age=n-b.born;if(age>b.life){this.bolts.splice(i,1);continue}const pr=age/b.life,fl=Math.random()<.14?.35:1,al=(1-pr)*(1-pr)*fl,bl=PERF.blur;this.x.shadowBlur=bl;this.x.shadowColor=`hsla(${b.hue},100%,65%,${al*.9})`;this.x.lineCap="round";this.x.lineJoin="round";
      this.x.strokeStyle=`hsla(${b.hue},100%,70%,${al*.5})`;this.x.lineWidth=b.w*3;this._dp(b.main);
      this.x.strokeStyle=`rgba(255,255,255,${al})`;this.x.lineWidth=b.w;this._dp(b.main);
      this.x.shadowBlur=bl*.6;for(const x of b.br){this.x.strokeStyle=`hsla(${b.hue},100%,82%,${al*.75})`;this.x.lineWidth=.8;this._dp(x)}}this.x.shadowBlur=0;
    const st=dt/16.67;for(let i=this.sparks.length-1;i>=0;i--){const s=this.sparks[i];s.x+=s.vx*st;s.y+=s.vy*st;s.vy+=.4*st;s.vx*=.985;s.life-=.03*st;if(s.life<=0){this.sparks.splice(i,1);continue}this.x.beginPath();this.x.fillStyle=`hsla(${s.hue},100%,80%,${s.life})`;this.x.shadowBlur=8;this.x.shadowColor=`hsla(${s.hue},100%,70%,${s.life})`;this.x.arc(s.x,s.y,s.size,0,Math.PI*2);this.x.fill()}this.x.shadowBlur=0;
    const fl=$("lt-flash");if(fl){fl.style.opacity=this.flash;this.flash*=Math.pow(.82,dt/16.67);if(this.flash<.01)this.flash=0}
    this.raf=requestAnimationFrame(()=>this._loop())}
  _dp(p){if(p.length<2)return;this.x.beginPath();this.x.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)this.x.lineTo(p[i].x,p[i].y);this.x.stroke()}
  _stop(){this.run=!1;if(this.raf)cancelAnimationFrame(this.raf);this.raf=null}
  async fire(){if(!this.enable)return;this.overlay();document.body.classList.add("lt-active");const e=$("lt-overlay");e.classList.add("lt-show");e.classList.remove("lt-hide");this._stop();this.run=!0;this.last=0;this._loop();const cnt=1+Math.floor(Math.random()*2);for(let i=0;i<cnt;i++){this._strike();this._thunder();document.body.classList.add("lt-shake");setTimeout(()=>document.body.classList.remove("lt-shake"),170);await new Promise(r=>setTimeout(r,170+Math.random()*180))}await new Promise(r=>setTimeout(r,500))}
  async close(){this._stop();const e=$("lt-overlay");if(e){e.classList.remove("lt-show");e.classList.add("lt-hide");await new Promise(r=>setTimeout(r,400));e.classList.remove("lt-hide")}this.x&&this.x.clearRect(0,0,this.w,this.h);this.bolts.length=0;this.sparks.length=0;document.body.classList.remove("lt-active","lt-shake")}
  label(t){const e=document.querySelector(".lt-text");if(e)e.textContent=t}
}
const L=new LT();window.Lightning=L;

// ═══════════════════════════════════════════════════════════
// ROUTER — NON-BLOCKING, pakai event delegation normal
// ═══════════════════════════════════════════════════════════
const TOOLS_INIT=new Map();       // id -> init fn
const TOOLS_SHOWN=new Set();      // yang sudah pernah show
let CURRENT=null, NAVIGATING=!1, FIRST=!0;

function getHash(){const h=location.hash.replace(/^#\/?/,"").trim();return h||null}
function setHash(id){const h="#/"+id;if(location.hash!==h)history.replaceState(null,"",h)}

window.registerTool=(id,initFn)=>{if(typeof initFn==="function")TOOLS_INIT.set(id,initFn)};

async function navigate(id,fromHash){
  if(NAVIGATING)return;
  if(id===CURRENT&&!fromHash)return;
  const tg=$("tool-"+id);
  if(!tg){console.warn("[router] missing:",id);return}
  NAVIGATING=!0;
  const title=(window.TOOL_TITLES&&window.TOOL_TITLES[id])||id;
  if(!FIRST&&L.enable){L.label("Memuat "+title+"...");await L.fire()}
  // Update UI
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.tool===id));
  document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
  tg.classList.add("active");
  const ti=$("current-tool-title");if(ti)ti.textContent=title;
  try{localStorage.setItem("lastTool",id)}catch(e){}
  const sb=$("sidebar");if(sb)sb.classList.remove("open");
  const ov=$("overlay");if(ov)ov.classList.remove("show");
  // Trigger init
  if(!TOOLS_SHOWN.has(id)){
    TOOLS_SHOWN.add(id);
    const fn=TOOLS_INIT.get(id);
    if(fn){try{await fn()}catch(e){console.error("[init "+id+"]",e)}}
    document.dispatchEvent(new CustomEvent("toolShow",{detail:{id}}));
  }
  CURRENT=id;setHash(id);
  if(!FIRST&&L.enable){await new Promise(r=>setTimeout(r,180));await L.close()}
  FIRST=!1;NAVIGATING=!1;
  const ct=document.querySelector(".content");if(ct)ct.scrollTo({top:0,behavior:"smooth"})
}

// Delegated click — NON-CAPTURE, non-block
document.addEventListener("click",(e)=>{
  const btn=e.target.closest(".nav button[data-tool]");
  if(!btn)return;
  const id=btn.dataset.tool;if(!id)return;
  // Kalau ada handler lain yang sudah handle (preventDefault), skip — biar tidak double
  if(e.defaultPrevented){e.preventDefault();return}
  e.preventDefault();
  navigate(id);
},false);

window.addEventListener("hashchange",()=>{if(NAVIGATING)return;const id=getHash();if(id&&id!==CURRENT)navigate(id,true)});

// Keyboard shortcut [ ]
document.addEventListener("keydown",(e)=>{
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.isContentEditable)return;
  if(e.key!=="["&&e.key!=="]")return;
  const btns=[...document.querySelectorAll(".nav button[data-tool]")];
  const i=btns.findIndex(b=>b.dataset.tool===CURRENT);if(i<0)return;
  const nx=(i+(e.key==="]"?1:-1)+btns.length)%btns.length;
  navigate(btns[nx].dataset.tool)
});

function boot(){if(!document.getElementById("tool-hash"))return;const h=getHash();const saved=h||localStorage.getItem("lastTool")||"hash";FIRST=!0;setTimeout(()=>navigate(saved,true),500)}
window.RouterNav={navigate,register:window.registerTool};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
