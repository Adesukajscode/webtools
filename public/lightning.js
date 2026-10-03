(function(){"use strict";
const $=id=>document.getElementById(id);

// ═══════════════════════════════════════════════════════
// LIGHTNING ENGINE
// ═══════════════════════════════════════════════════════
class Lightning{
  constructor(){
    this.canvas=null;this.ctx=null;this.w=0;this.h=0;
    this.bolts=[];this.sparks=[];this.flashAlpha=0;
    this.running=false;this.strikeTimer=null;
    this.soundCtx=null;this.soundEnabled=true;
  }
  overlay(){
    let el=$("lt-overlay");
    if(el)return el;
    el=document.createElement("div");
    el.id="lt-overlay";
    el.className="lt-overlay";
    el.innerHTML=`
      <canvas id="lt-canvas"></canvas>
      <div class="lt-flash" id="lt-flash"></div>
      <div class="lt-label" id="lt-label">
        <div class="lt-icon">⚡</div>
        <div class="lt-text">Memuat halaman...</div>
      </div>
    `;
    document.body.appendChild(el);
    this.canvas=$("lt-canvas");
    this.ctx=this.canvas.getContext("2d");
    this._resize();
    window.addEventListener("resize",()=>this._resize());
    return el
  }
  _resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    this.w=window.innerWidth;this.h=window.innerHeight;
    if(this.canvas){
      this.canvas.width=this.w*dpr;
      this.canvas.height=this.h*dpr;
      this.canvas.style.width=this.w+"px";
      this.canvas.style.height=this.h+"px";
      this.ctx.setTransform(dpr,0,0,dpr,0,0)
    }
  }
  // Generate bolt path — recursive fractal
  _generateBolt(x1,y1,x2,y2,depth=0,maxDepth=7){
    const path=[{x:x1,y:y1}];
    this._subdivide(x1,y1,x2,y2,path,depth,maxDepth);
    path.push({x:x2,y:y2});
    return path
  }
  _subdivide(x1,y1,x2,y2,path,depth,maxDepth){
    if(depth>=maxDepth)return;
    // displacement: makin dalam makin kecil
    const dist=Math.hypot(x2-x1,y2-y1);
    const disp=dist*(0.15+Math.random()*0.15)*(1-depth/maxDepth);
    const mx=(x1+x2)/2+(Math.random()-0.5)*disp;
    const my=(y1+y2)/2+(Math.random()-0.5)*disp*0.3;
    path.push({x:mx,y:my});
    this._subdivide(x1,y1,mx,my,path,depth+1,maxDepth);
    this._subdivide(mx,my,x2,y2,path,depth+1,maxDepth);
  }
  // Branch off main bolt
  _branches(mainBolt){
    const branches=[];
    const points=mainBolt.length;
    for(let i=4;i<points-2;i++){
      if(Math.random()<0.35){
        const p=mainBolt[i];
        const angle=Math.PI/2+(Math.random()-0.5)*1.5;
        const len=80+Math.random()*180;
        const ex=p.x+Math.cos(angle)*len;
        const ey=p.y+Math.abs(Math.sin(angle))*len*0.6;
        branches.push(this._generateBolt(p.x,p.y,ex,ey,0,4))
      }
    }
    return branches
  }
  // Create one strike
  _createStrike(){
    const startX=this.w*(0.2+Math.random()*0.6);
    const startY=0;
    const endX=startX+(Math.random()-0.5)*this.w*0.5;
    const endY=this.h*(0.6+Math.random()*0.4);
    const main=this._generateBolt(startX,startY,endX,endY,0,7);
    const branches=this._branches(main);
    this.bolts.push({
      main,
      branches,
      life:1,
      width:2+Math.random()*2,
      hue:200+Math.random()*40,
      born:Date.now()
    });
    // End sparks
    const endP=main[main.length-1];
    for(let i=0;i<25;i++){
      const a=Math.random()*Math.PI*2;
      const sp=2+Math.random()*8;
      this.sparks.push({
        x:endP.x,y:endP.y,
        vx:Math.cos(a)*sp,
        vy:Math.sin(a)*sp,
        life:1,
        size:1+Math.random()*2,
        hue:200+Math.random()*60
      })
    }
    // Flash
    this.flashAlpha=0.5+Math.random()*0.3
  }
  // Audio thunder (Web Audio API)
  _thunder(){
    if(!this.soundEnabled)return;
    try{
      if(!this.soundCtx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)return;
        this.soundCtx=new AC()
      }
      const ctx=this.soundCtx;
      const dur=1.2;
      const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
      const data=buf.getChannelData(0);
      for(let i=0;i<data.length;i++){
        const t=i/ctx.sampleRate;
        const env=Math.exp(-t*2)*(1-Math.exp(-t*30));
        data[i]=(Math.random()*2-1)*env
      }
      const src=ctx.createBufferSource();
      src.buffer=buf;
      const filter=ctx.createBiquadFilter();
      filter.type="lowpass";
      filter.frequency.setValueAtTime(400,ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+dur);
      const gain=ctx.createGain();
      gain.gain.setValueAtTime(0.15,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    }catch(e){}
  }
  // Render loop
  _tick(){
    if(!this.running)return;
    const ctx=this.ctx;
    ctx.clearRect(0,0,this.w,this.h);
    // Render bolts
    const now=Date.now();
    for(let i=this.bolts.length-1;i>=0;i--){
      const b=this.bolts[i];
      const age=(now-b.born)/380;
      if(age>1){this.bolts.splice(i,1);continue}
      // flicker
      const flicker=Math.random()<0.15?0.3:1;
      const alpha=(1-age)*flicker;
      // glow
      ctx.shadowBlur=25;
      ctx.shadowColor=`hsla(${b.hue},100%,65%,${alpha*0.9})`;
      ctx.lineCap="round";
      ctx.lineJoin="round";
      // main bolt — glow pass
      ctx.strokeStyle=`hsla(${b.hue},100%,70%,${alpha*0.55})`;
      ctx.lineWidth=b.width*3;
      this._drawPath(b.main);
      // main bolt — core
      ctx.strokeStyle=`rgba(255,255,255,${alpha})`;
      ctx.lineWidth=b.width;
      this._drawPath(b.main);
      // branches
      ctx.shadowBlur=12;
      b.branches.forEach(br=>{
        ctx.strokeStyle=`hsla(${b.hue},100%,80%,${alpha*0.7})`;
        ctx.lineWidth=0.8;
        this._drawPath(br)
      });
      ctx.shadowBlur=0
    }
    // Sparks
    for(let i=this.sparks.length-1;i>=0;i--){
      const s=this.sparks[i];
      s.x+=s.vx;s.y+=s.vy;
      s.vy+=0.4;
      s.life-=0.03;
      if(s.life<=0){this.sparks.splice(i,1);continue}
      ctx.beginPath();
      ctx.fillStyle=`hsla(${s.hue},100%,80%,${s.life})`;
      ctx.shadowBlur=8;
      ctx.shadowColor=`hsla(${s.hue},100%,70%,${s.life})`;
      ctx.arc(s.x,s.y,s.size,0,Math.PI*2);
      ctx.fill();
      ctx.shadowBlur=0
    }
    // Flash overlay
    const flash=$("lt-flash");
    if(flash){
      flash.style.opacity=this.flashAlpha;
      this.flashAlpha*=0.82;
      if(this.flashAlpha<0.01)this.flashAlpha=0
    }
    requestAnimationFrame(()=>this._tick())
  }
  _drawPath(path){
    const ctx=this.ctx;
    ctx.beginPath();
    ctx.moveTo(path[0].x,path[0].y);
    for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);
    ctx.stroke()
  }
  // Public API: trigger one strike sequence
  async strike(){
    this.overlay();
    document.body.classList.add("lt-active");
    const el=$("lt-overlay");
    if(el)el.classList.add("lt-show");
    this.running=true;this._tick();
    // 1-3 bolts sequential
    const count=1+Math.floor(Math.random()*2);
    for(let i=0;i<count;i++){
      this._createStrike();
      this._thunder();
      // shake
      document.body.classList.add("lt-shake");
      setTimeout(()=>document.body.classList.remove("lt-shake"),180);
      await new Promise(r=>setTimeout(r,180+Math.random()*200))
    }
    // hold for label
    await new Promise(r=>setTimeout(r,600))
  }
  async end(){
    this.running=false;
    const el=$("lt-overlay");
    if(el){
      el.classList.remove("lt-show");
      el.classList.add("lt-hide");
      await new Promise(r=>setTimeout(r,500));
      el.classList.remove("lt-hide");
      if(this.ctx)this.ctx.clearRect(0,0,this.w,this.h)
    }
    document.body.classList.remove("lt-active","lt-shake")
  }
  setLabel(text){
    const el=$("lt-text")||document.querySelector(".lt-text");
    if(el)el.textContent=text
  }
}

const LT=new Lightning();
window.Lightning=LT;

// ═══════════════════════════════════════════════════════
// ROUTER — hash-based per-tool
// ═══════════════════════════════════════════════════════
let currentTool=null;
let isFirstLoad=true;

function getHashTool(){
  const h=location.hash.replace(/^#\/?/,"").trim();
  return h||null
}

function setHashTool(id){
  const h="#/"+id;
  if(location.hash!==h)history.replaceState(null,"",h)
}

async function navigateTo(id,fromHash){
  if(id===currentTool&&!fromHash)return;
  const target=$("tool-"+id);
  if(!target){
    console.warn("[router] tool not found:",id);
    return
  }
  // Trigger lightning (skip saat first load)
  if(!isFirstLoad){
    LT.setLabel("Memuat "+(window.TOOL_TITLES?.[id]||id)+"...");
    await LT.strike()
  }
  // Show tool
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.tool===id));
  document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
  target.classList.add("active");
  const ti=$("current-tool-title");
  if(ti)ti.textContent=(window.TOOL_TITLES?.[id])||id;
  localStorage.setItem("lastTool",id);
  $("sidebar")?.classList.remove("open");
  $("overlay")?.classList.remove("show");
  // Bind lazy
  if(target&&!target.dataset.bound){
    target.dataset.bound="1";
    // let tool script handle binding via click listener
    document.dispatchEvent(new CustomEvent("toolShow",{detail:{id}}))
  }
  currentTool=id;
  setHashTool(id);
  // End lightning
  if(!isFirstLoad){
    await new Promise(r=>setTimeout(r,200));
    await LT.end()
  }
  isFirstLoad=false;
  // Scroll top
  document.querySelector(".content")?.scrollTo({top:0,behavior:"smooth"})
}

// Intercept nav click — semua tool trigger lightning
document.addEventListener("click",async e=>{
  const btn=e.target.closest(".nav button[data-tool]");
  if(!btn)return;
  const id=btn.dataset.tool;
  if(!id)return;
  // cegah default handler lain dijalankan duluan
  e.preventDefault();
  e.stopPropagation();
  navigateTo(id)
},true);

// Hash change
window.addEventListener("hashchange",()=>{
  const id=getHashTool();
  if(id&&id!==currentTool)navigateTo(id,true)
});

// Boot — restore dari hash atau lastTool
function boot(){
  if(!document.getElementById("tool-hash"))return;
  const h=getHashTool();
  const saved=h||localStorage.getItem("lastTool")||"hash";
  isFirstLoad=true;
  // delay biar semua tool script selesai build dulu
  setTimeout(()=>navigateTo(saved,true),900)
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

})();
