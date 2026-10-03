(function(){"use strict";
const $=id=>document.getElementById(id);
const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ═══════════════════════════════════════════════════════
// PERF MONITOR — auto detect device capability
// ═══════════════════════════════════════════════════════
const PERF={
  targetFPS:120,
  minFPS:50,
  currentFPS:0,
  quality:"high", // high | medium | low
  frames:0,
  lastSample:0,
  drops:0,
  monitor(){
    this.frames++;
    const now=performance.now();
    if(now-this.lastSample>=1000){
      this.currentFPS=this.frames;
      this.frames=0;this.lastSample=now;
      // adaptive quality
      if(this.currentFPS<this.minFPS){
        this.drops++;
        if(this.drops>=2&&this.quality!=="low"){
          this.quality=this.quality==="high"?"medium":"low";
          this.drops=0;
          console.log("[perf] downgrade →",this.quality)
        }
      }else if(this.currentFPS>=110){
        this.drops=0;
        if(this.quality==="medium"&&this.currentFPS>=115)this.quality="high"
      }
    }
  },
  get sparkCount(){return this.quality==="high"?28:this.quality==="medium"?16:8},
  get shadowBlur(){return this.quality==="high"?20:this.quality==="medium"?12:6},
  get maxBolts(){return this.quality==="high"?3:this.quality==="medium"?2:1},
  get branchChance(){return this.quality==="high"?0.35:this.quality==="medium"?0.22:0.12}
};

// ═══════════════════════════════════════════════════════
// OBJECT POOL — spark particles
// ═══════════════════════════════════════════════════════
class SparkPool{
  constructor(max=200){this.pool=[];this.active=[];this.max=max}
  spawn(x,y){
    let s=this.pool.pop();
    if(!s)s={x:0,y:0,vx:0,vy:0,life:0,size:0,hue:0};
    const a=Math.random()*Math.PI*2,sp=2+Math.random()*9;
    s.x=x;s.y=y;
    s.vx=Math.cos(a)*sp;
    s.vy=Math.sin(a)*sp;
    s.life=1;
    s.size=1+Math.random()*2.2;
    s.hue=200+Math.random()*50;
    this.active.push(s)
  }
  update(dt){
    const step=dt/16.67; // normalized to 60fps baseline
    for(let i=this.active.length-1;i>=0;i--){
      const s=this.active[i];
      s.x+=s.vx*step;
      s.y+=s.vy*step;
      s.vy+=0.4*step;
      s.vx*=0.985;
      s.life-=0.03*step;
      if(s.life<=0){
        this.pool.push(s);
        this.active.splice(i,1)
      }
    }
  }
  render(ctx){
    if(!this.active.length)return;
    ctx.shadowBlur=8;
    for(const s of this.active){
      ctx.beginPath();
      ctx.fillStyle=`hsla(${s.hue},100%,80%,${s.life})`;
      ctx.shadowColor=`hsla(${s.hue},100%,70%,${s.life})`;
      ctx.arc(s.x,s.y,s.size,0,Math.PI*2);
      ctx.fill()
    }
    ctx.shadowBlur=0
  }
  clear(){for(const s of this.active)this.pool.push(s);this.active.length=0}
}

// ═══════════════════════════════════════════════════════
// LIGHTNING ENGINE — delta-time, offscreen cache
// ═══════════════════════════════════════════════════════
class Lightning{
  constructor(){
    this.canvas=null;this.ctx=null;this.w=0;this.h=0;this.dpr=1;
    this.bolts=[];this.sparks=new SparkPool();
    this.flashAlpha=0;this.running=false;
    this.lastT=0;this.rafId=null;
    this.boltCache=new Map(); // cached geometry
    this.soundCtx=null;this.soundEnabled=true;
    this.reducedMotion=RM;
    this._onVis=this._onVis.bind(this);
  }
  overlay(){
    let el=$("lt-overlay");
    if(el){
      this.canvas=$("lt-canvas");
      this.ctx=this.canvas.getContext("2d",{alpha:!0,desynchronized:!0});
      return el
    }
    el=document.createElement("div");
    el.id="lt-overlay";
    el.className="lt-overlay";
    el.innerHTML=`<canvas id="lt-canvas"></canvas><div class="lt-flash" id="lt-flash"></div><div class="lt-label" id="lt-label"><div class="lt-icon">⚡</div><div class="lt-text">Memuat halaman...</div></div>`;
    document.body.appendChild(el);
    this.canvas=$("lt-canvas");
    this.ctx=this.canvas.getContext("2d",{alpha:!0,desynchronized:!0});
    this._resize();
    window.addEventListener("resize",()=>this._resize(),{passive:!0});
    document.addEventListener("visibilitychange",this._onVis);
    return el
  }
  _onVis(){
    if(document.hidden)this.running=false;
    else if(this.overlay().classList.contains("lt-show")){
      this.running=true;this.lastT=0;this._loop()
    }
  }
  _resize(){
    this.dpr=Math.min(window.devicePixelRatio||1,2);
    this.w=window.innerWidth;this.h=window.innerHeight;
    if(this.canvas){
      this.canvas.width=this.w*this.dpr;
      this.canvas.height=this.h*this.dpr;
      this.canvas.style.width=this.w+"px";
      this.canvas.style.height=this.h+"px";
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0)
    }
  }
  // Generate bolt geometry (cached — fractal recursive, iterative)
  _genBolt(x1,y1,x2,y2,maxDepth=7){
    const key=`${x1.toFixed(0)},${y1.toFixed(0)},${x2.toFixed(0)},${y2.toFixed(0)},${maxDepth}`;
    if(this.boltCache.has(key))return this.boltCache.get(key);
    const path=[{x:x1,y:y1}];
    const stack=[{x1,y1,x2,y2,depth:0}];
    while(stack.length){
      const it=stack.pop();
      if(it.depth>=maxDepth){
        path.push({x:it.x2,y:it.y2});
        continue
      }
      const dist=Math.hypot(it.x2-it.x1,it.y2-it.y1);
      const disp=dist*(0.14+Math.random()*0.14)*(1-it.depth/maxDepth);
      const mx=(it.x1+it.x2)/2+(Math.random()-0.5)*disp;
      const my=(it.y1+it.y2)/2+(Math.random()-0.5)*disp*0.35;
      stack.push({x1:mx,y1:my,x2:it.x2,y2:it.y2,depth:it.depth+1});
      stack.push({x1:it.x1,y1:it.y1,x2:mx,y2:my,depth:it.depth+1})
    }
    path.sort((a,b)=>Math.hypot(a.x-x1,a.y-y1)-Math.hypot(b.x-x1,b.y-y1));
    this.boltCache.set(key,path);
    if(this.boltCache.size>20){
      const first=this.boltCache.keys().next().value;
      this.boltCache.delete(first)
    }
    return path
  }
  _genBranches(main){
    const branches=[];
    const chance=PERF.branchChance;
    for(let i=4;i<main.length-2;i++){
      if(Math.random()<chance){
        const p=main[i];
        const angle=Math.PI/2+(Math.random()-0.5)*1.6;
        const len=60+Math.random()*160;
        const ex=p.x+Math.cos(angle)*len;
        const ey=p.y+Math.abs(Math.sin(angle))*len*0.6;
        branches.push(this._genBolt(p.x,p.y,ex,ey,4))
      }
    }
    return branches
  }
  _createStrike(){
    const startX=this.w*(0.15+Math.random()*0.7);
    const startY=-20;
    const endX=startX+(Math.random()-0.5)*this.w*0.55;
    const endY=this.h*(0.55+Math.random()*0.45);
    const main=this._genBolt(startX,startY,endX,endY,7);
    const branches=this._genBranches(main);
    this.bolts.push({
      main,branches,
      born:performance.now(),
      lifetime:420, // ms — delta-based
      width:2.2+Math.random()*1.8,
      hue:200+Math.random()*45
    });
    // spawn sparks
    const endP=main[main.length-1];
    const sc=PERF.sparkCount;
    for(let i=0;i<sc;i++)this.sparks.spawn(endP.x,endP.y);
    this.flashAlpha=0.55+Math.random()*0.25
  }
  _thunder(){
    if(!this.soundEnabled||this.reducedMotion)return;
    try{
      if(!this.soundCtx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)return;
        this.soundCtx=new AC()
      }
      const ctx=this.soundCtx;
      const dur=1.1;
      const sr=ctx.sampleRate;
      const buf=ctx.createBuffer(1,sr*dur,sr);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++){
        const t=i/sr;
        const env=Math.exp(-t*2.2)*(1-Math.exp(-t*32));
        d[i]=(Math.random()*2-1)*env
      }
      const src=ctx.createBufferSource();
      src.buffer=buf;
      const flt=ctx.createBiquadFilter();
      flt.type="lowpass";
      flt.frequency.setValueAtTime(420,ctx.currentTime);
      flt.frequency.exponentialRampToValueAtTime(70,ctx.currentTime+dur);
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.14,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      src.connect(flt);flt.connect(g);g.connect(ctx.destination);
      src.start()
    }catch(e){}
  }
  // MAIN LOOP — delta-time
  _loop(){
    if(!this.running)return;
    const now=performance.now();
    if(!this.lastT)this.lastT=now;
    let dt=now-this.lastT;
    this.lastT=now;
    if(dt>100)dt=100; // clamp (tab switch)
    const ctx=this.ctx;
    if(!ctx){this.rafId=requestAnimationFrame(()=>this._loop());return}
    PERF.monitor();
    ctx.clearRect(0,0,this.w,this.h);
    // render bolts
    for(let i=this.bolts.length-1;i>=0;i--){
      const b=this.bolts[i];
      const age=now-b.born;
      if(age>b.lifetime){this.bolts.splice(i,1);continue}
      const prog=age/b.lifetime;
      const flicker=Math.random()<0.14?0.35:1;
      const alpha=(1-prog)*(1-prog)*flicker;
      const blur=PERF.shadowBlur;
      ctx.shadowBlur=blur;
      ctx.shadowColor=`hsla(${b.hue},100%,65%,${alpha*0.9})`;
      ctx.lineCap="round";ctx.lineJoin="round";
      // glow pass
      ctx.strokeStyle=`hsla(${b.hue},100%,70%,${alpha*0.5})`;
      ctx.lineWidth=b.width*3;
      this._drawPath(b.main);
      // core pass
      ctx.strokeStyle=`rgba(255,255,255,${alpha})`;
      ctx.lineWidth=b.width;
      this._drawPath(b.main);
      // branches
      ctx.shadowBlur=blur*0.6;
      for(const br of b.branches){
        ctx.strokeStyle=`hsla(${b.hue},100%,82%,${alpha*0.75})`;
        ctx.lineWidth=0.8;
        this._drawPath(br)
      }
      ctx.shadowBlur=0
    }
    // sparks (delta-based)
    this.sparks.update(dt);
    this.sparks.render(ctx);
    // flash decay (delta-normalized)
    const flash=$("lt-flash");
    if(flash){
      flash.style.opacity=this.flashAlpha;
      this.flashAlpha*=Math.pow(0.82,dt/16.67);
      if(this.flashAlpha<0.01)this.flashAlpha=0
    }
    this.rafId=requestAnimationFrame(()=>this._loop())
  }
  _drawPath(path){
    const ctx=this.ctx;
    if(path.length<2)return;
    ctx.beginPath();
    ctx.moveTo(path[0].x,path[0].y);
    for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);
    ctx.stroke()
  }
  async strike(){
    this.overlay();
    if(this.reducedMotion){this.setLabel("Memuat...");return}
    document.body.classList.add("lt-active");
    const el=$("lt-overlay");
    el.classList.add("lt-show");
    el.classList.remove("lt-hide");
    this.running=true;this.lastT=0;
    if(this.rafId)cancelAnimationFrame(this.rafId);
    this._loop();
    const count=Math.min(PERF.maxBolts,1+Math.floor(Math.random()*2));
    for(let i=0;i<count;i++){
      this._createStrike();
      this._thunder();
      document.body.classList.add("lt-shake");
      setTimeout(()=>document.body.classList.remove("lt-shake"),170);
      await new Promise(r=>setTimeout(r,170+Math.random()*180))
    }
    await new Promise(r=>setTimeout(r,this.reducedMotion?0:550))
  }
  async end(){
    this.running=false;
    if(this.rafId)cancelAnimationFrame(this.rafId);
    const el=$("lt-overlay");
    if(el&&!this.reducedMotion){
      el.classList.remove("lt-show");
      el.classList.add("lt-hide");
      await new Promise(r=>setTimeout(r,420));
      el.classList.remove("lt-hide")
    }else if(el){
      el.classList.remove("lt-show")
    }
    if(this.ctx)this.ctx.clearRect(0,0,this.w,this.h);
    this.bolts.length=0;
    this.sparks.clear();
    document.body.classList.remove("lt-active","lt-shake")
  }
  setLabel(text){
    const el=document.querySelector(".lt-text");
    if(el)el.textContent=text
  }
}

const LT=new Lightning();
window.Lightning=LT;
window.LightningPerf=PERF;

// ═══════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════
let currentTool=null;
let isFirstLoad=true;
let navigating=false;
const navCache=new Map();

function getHashTool(){
  const h=location.hash.replace(/^#\/?/,"").trim();
  return h||null
}
function setHashTool(id){
  const h="#/"+id;
  if(location.hash!==h)history.replaceState(null,"",h)
}

async function navigateTo(id,fromHash){
  if(navigating)return;
  if(id===currentTool&&!fromHash)return;
  const target=$("tool-"+id);
  if(!target){console.warn("[router] not found:",id);return}
  navigating=true;
  const label=(window.TOOL_TITLES?.[id])||id;
  if(!isFirstLoad&&!RM){
    LT.setLabel("Memuat "+label+"...");
    await LT.strike()
  }
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.tool===id));
  document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
  target.classList.add("active");
  const ti=$("current-tool-title");
  if(ti)ti.textContent=label;
  localStorage.setItem("lastTool",id);
  $("sidebar")?.classList.remove("open");
  $("overlay")?.classList.remove("show");
  if(!navCache.has(id)){
    navCache.set(id,1);
    document.dispatchEvent(new CustomEvent("toolShow",{detail:{id}}))
  }
  currentTool=id;
  setHashTool(id);
  if(!isFirstLoad&&!RM){
    await new Promise(r=>setTimeout(r,180));
    await LT.end()
  }
  isFirstLoad=false;
  navigating=false;
  document.querySelector(".content")?.scrollTo({top:0,behavior:"smooth"})
}

// Intercept nav
document.addEventListener("click",e=>{
  const btn=e.target.closest(".nav button[data-tool]");
  if(!btn)return;
  const id=btn.dataset.tool;
  if(!id)return;
  e.preventDefault();
  e.stopPropagation();
  navigateTo(id)
},true);

window.addEventListener("hashchange",()=>{
  if(navigating)return;
  const id=getHashTool();
  if(id&&id!==currentTool)navigateTo(id,true)
});

// Keyboard shortcut: [ / ] untuk prev/next tool
document.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
  if(e.key==="["||e.key==="]"){
    const btns=[...document.querySelectorAll(".nav button[data-tool]")];
    const idx=btns.findIndex(b=>b.dataset.tool===currentTool);
    if(idx===-1)return;
    const next=(idx+(e.key==="]"?1:-1)+btns.length)%btns.length;
    navigateTo(btns[next].dataset.tool)
  }
});

function boot(){
  if(!document.getElementById("tool-hash"))return;
  const h=getHashTool();
  const saved=h||localStorage.getItem("lastTool")||"hash";
  isFirstLoad=true;
  setTimeout(()=>navigateTo(saved,true),800)
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

})();
