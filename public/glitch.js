(function(){"use strict";
const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if(RM)return;

const COLOR_A="#06b6d4";
const COLOR_B="#f472b6";
const COLOR_C="#3b82f6";

// ═══════════════════════════════════════════════════════
// GLITCH ENGINE — JS-driven, tidak pakai CSS keyframes
// ═══════════════════════════════════════════════════════
class Glitch{
  constructor(el){
    this.el=el;
    this.text=el.dataset.text||el.textContent;
    this.active=!1;
    this.bursting=!1;
    this.timer=null;
    this.init()
  }
  init(){
    // Setup struktur: konten + 2 layer pseudo
    this.el.classList.add("glitch-js");
    this.el.style.position="relative";
    this.el.style.display="inline-block";
    this.el.innerHTML=`
      <span class="glitch-layer glitch-base">${this.text}</span>
      <span class="glitch-layer glitch-a" aria-hidden="true">${this.text}</span>
      <span class="glitch-layer glitch-b" aria-hidden="true">${this.text}</span>
    `;
    this.base=this.el.querySelector(".glitch-base");
    this.layerA=this.el.querySelector(".glitch-a");
    this.layerB=this.el.querySelector(".glitch-b");
    // Style layer overlay
    [this.layerA,this.layerB].forEach(l=>{
      Object.assign(l.style,{
        position:"absolute",
        top:"0",left:"0",
        width:"100%",
        pointerEvents:"none",
        userSelect:"none",
        overflow:"hidden"
      })
    });
    this.layerA.style.color=COLOR_A;
    this.layerB.style.color=COLOR_B;
    this.layerA.style.mixBlendMode="screen";
    this.layerB.style.mixBlendMode="screen";
    this.layerA.style.opacity="0.7";
    this.layerB.style.opacity="0.7";
    this.reset();
    this.schedule()
  }
  reset(){
    this.base.style.transform="translate(0,0)";
    this.base.style.clipPath="none";
    this.base.style.filter="";
    this.layerA.style.transform="translate(0,0)";
    this.layerA.style.clipPath="inset(100% 0 0 0)";
    this.layerA.style.opacity="0";
    this.layerB.style.transform="translate(0,0)";
    this.layerB.style.clipPath="inset(100% 0 0 0)";
    this.layerB.style.opacity="0";
  }
  // One glitch burst — multiple frames
  async burst(){
    if(this.bursting)return;
    this.bursting=!0;
    const frames=3+Math.floor(Math.random()*4); // 3-6 frames
    for(let i=0;i<frames;i++){
      const dx=(Math.random()-.5)*6; // -3 to +3
      const dy=(Math.random()-.5)*2;
      const skew=(Math.random()-.5)*2;
      // Split region acak
      const top1=Math.random()*40;
      const bot1=top1+20+Math.random()*30;
      const top2=60+Math.random()*20;
      const bot2=Math.min(100,top2+15+Math.random()*25);
      // Base shift
      this.base.style.transform=`translate(${dx*0.3}px,${dy*0.3}px) skewX(${skew*0.3}deg)`;
      // Layer A
      this.layerA.style.transform=`translate(${dx}px,${dy}px)`;
      this.layerA.style.clipPath=`inset(${top1}% 0 ${100-bot1}% 0)`;
      this.layerA.style.opacity=String(0.5+Math.random()*0.5);
      this.layerA.style.color=Math.random()<0.5?COLOR_A:COLOR_C;
      // Layer B
      this.layerB.style.transform=`translate(${-dx}px,${-dy}px)`;
      this.layerB.style.clipPath=`inset(${top2}% 0 ${100-bot2}% 0)`;
      this.layerB.style.opacity=String(0.5+Math.random()*0.5);
      this.layerB.style.color=Math.random()<0.5?COLOR_B:COLOR_C;
      // RGB shadow di base
      this.base.style.textShadow=[
        `${dx*0.5}px 0 ${COLOR_A}`,
        `${-dx*0.5}px 0 ${COLOR_B}`,
        `0 0 20px rgba(59,130,246,.35)`
      ].join(", ");
      await this.wait(40+Math.random()*70);
    }
    // Fade out
    this.reset();
    this.bursting=!1;
  }
  wait(ms){return new Promise(r=>setTimeout(r,ms))}
  schedule(){
    if(this.timer)clearTimeout(this.timer);
    // Burst setiap 3-7 detik
    const delay=3000+Math.random()*4000;
    this.timer=setTimeout(()=>{
      this.burst();
      this.schedule();
    },delay)
  }
}

// ═══════════════════════════════════════════════════════
// AUTO-REGISTER elemen .glitch
// ═══════════════════════════════════════════════════════
const instances=new Map();
function scan(){
  document.querySelectorAll(".glitch:not(.glitch-js)").forEach(el=>{
    // Skip yang punya data-text sudah diproses
    if(el.dataset.glitchInit)return;
    el.dataset.glitchInit="1";
    instances.set(el,new Glitch(el))
  })
}
// Observer untuk deteksi elemen baru (home.js render setelah DOM ready)
const mo=new MutationObserver(()=>{scan()});
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",()=>{
    scan();
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(scan,1500);
    setTimeout(scan,3000);
  })
}else{
  scan();
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(scan,1500);
  setTimeout(scan,3000);
}

// Public API — test manual di console
window.GlitchFX={
  scan,
  burstAll:()=>instances.forEach(g=>g.burst()),
  count:()=>instances.size
};
})();
