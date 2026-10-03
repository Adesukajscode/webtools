(function(){"use strict";
const $=id=>document.getElementById(id);
let raf=null,running=!1,tz="Asia/Jakarta",lbl="Jakarta (WIB)",canvas=null,ctx=null,W=0,H=0,DPR=1;

const TZ={"Jakarta (WIB)":"Asia/Jakarta","Makassar (WITA)":"Asia/Makassar","Jayapura (WIT)":"Asia/Jayapura","Singapore":"Asia/Singapore","Tokyo":"Asia/Tokyo","London":"Europe/London","New York":"America/New_York","UTC":"UTC"};

function getTime(){
  const f=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:!1,hour:"numeric",minute:"numeric",second:"numeric",weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const p={};f.formatToParts(new Date()).forEach(x=>p[x.type]=x.value);
  return{hr:parseInt(p.hour)%24,min:parseInt(p.minute),sec:parseInt(p.second),ms:performance.now()%1000,wk:p.weekday,d:parseInt(p.day),mo:p.month,yr:parseInt(p.year)}
}

function resize(){
  if(!canvas)return;
  DPR=Math.min(window.devicePixelRatio||1,2);
  const size=Math.min(canvas.parentElement.clientWidth-40,320);
  W=size;H=size;
  canvas.width=size*DPR;canvas.height=size*DPR;
  canvas.style.width=size+"px";canvas.style.height=size+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
}

function draw(){
  if(!running||!ctx)return;
  const t=getTime();
  const cx=W/2,cy=H/2,R=W/2-8;
  const cs=getComputedStyle(document.documentElement);
  const clrText=cs.getPropertyValue("--text").trim()||"#e8e8f0";
  const clrAcc=cs.getPropertyValue("--accent").trim()||"#16a34a";
  const clrDim=cs.getPropertyValue("--text-dim").trim()||"#8a8aa0";
  const isDark=document.documentElement.getAttribute("data-theme")!=="light";

  ctx.clearRect(0,0,W,H);

  // Glow ring luar
  ctx.save();
  ctx.shadowBlur=20;ctx.shadowColor=clrAcc+"40";
  ctx.beginPath();ctx.arc(cx,cy,R-2,0,Math.PI*2);
  ctx.strokeStyle=clrAcc+"30";ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();

  // Face gradient
  const g=ctx.createRadialGradient(cx,cy-R*.3,10,cx,cy,R);
  g.addColorStop(0,isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.03)");
  g.addColorStop(1,isDark?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.06)");
  ctx.beginPath();ctx.arc(cx,cy,R-6,0,Math.PI*2);
  ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle=clrDim;ctx.globalAlpha=.35;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;

  // Inner ring
  ctx.beginPath();ctx.arc(cx,cy,R-16,0,Math.PI*2);
  ctx.strokeStyle=clrDim;ctx.globalAlpha=.15;ctx.lineWidth=.8;ctx.stroke();ctx.globalAlpha=1;

  // Jam ticks (12)
  for(let i=0;i<12;i++){
    const a=(i*30-90)*Math.PI/180;
    const r1=R-22,r2=R-10;
    const w=i%3===0?3.5:1.5;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
    ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);
    ctx.strokeStyle=clrText;
    ctx.globalAlpha=i%3===0?.9:.45;
    ctx.lineWidth=w;ctx.lineCap="round";ctx.stroke();
    ctx.globalAlpha=1;
  }

  // Menit ticks (60)
  for(let i=0;i<60;i++){
    if(i%5===0)continue;
    const a=(i*6-90)*Math.PI/180;
    const r1=R-15,r2=R-10;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
    ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);
    ctx.strokeStyle=clrDim;ctx.globalAlpha=.25;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;
  }

  // Angka 1-12
  ctx.fillStyle=clrText;
  ctx.font="bold "+Math.floor(R*.14)+"px Inter,system-ui,sans-serif";
  ctx.textAlign="center";ctx.textBaseline="middle";
  for(let i=1;i<=12;i++){
    const a=(i*30-90)*Math.PI/180;
    const r=R-38;
    ctx.globalAlpha=.85;
    ctx.fillText(String(i),cx+Math.cos(a)*r,cy+Math.sin(a)*r+1);
    ctx.globalAlpha=1;
  }

  // Sudut jam (rotasi) — jam 12 = -90°
  const hourA=(t.hr%12+t.min/60+t.sec/3600)*30-90;
  const minA=(t.min+t.sec/60+t.ms/60000)*6-90;
  const secA=(t.sec+t.ms/1000)*6-90;

  // Jarum jam (hour) — panjang 55%
  drawHand(cx,cy,hourA,R*.55,7,clrText,"round");
  // Jarum menit — panjang 72%
  drawHand(cx,cy,minA,R*.72,5,clrText,"round");
  // Jarum detik — panjang 82% + ekor 12%
  drawSecHand(cx,cy,secA,R*.82,R*.18,clrAcc);

  // Pusat
  ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fillStyle=clrText;ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fillStyle=clrAcc;ctx.fill();
  ctx.shadowBlur=8;ctx.shadowColor=clrAcc;
  ctx.beginPath();ctx.arc(cx,cy,2,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
  ctx.shadowBlur=0;

  // Update digital + tanggal
  const dig=$("ac-digital"),dt=$("ac-date"),tzEl=$("ac-tz");
  if(dig)dig.textContent=String(t.hr).padStart(2,"0")+":"+String(t.min).padStart(2,"0")+":"+String(t.sec).padStart(2,"0");
  if(dt)dt.textContent=t.wk+", "+t.d+" "+t.mo+" "+t.yr;
  if(tzEl)tzEl.textContent=lbl;

  raf=requestAnimationFrame(draw);
}

function drawHand(cx,cy,angDeg,len,width,color,cap){
  const a=angDeg*Math.PI/180;
  const x=cx+Math.cos(a)*len,y=cy+Math.sin(a)*len;
  ctx.save();
  ctx.shadowBlur=6;ctx.shadowColor="rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(cx-Math.cos(a)*len*0.12,cy-Math.sin(a)*len*0.12);
  ctx.lineTo(x,y);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap=cap||"round";ctx.stroke();
  ctx.restore();
}

function drawSecHand(cx,cy,angDeg,len,tail,color){
  const a=angDeg*Math.PI/180;
  const x=cx+Math.cos(a)*len,y=cy+Math.sin(a)*len;
  const tx=cx-Math.cos(a)*tail,ty=cy-Math.sin(a)*tail;
  ctx.save();
  ctx.shadowBlur=14;ctx.shadowColor=color;
  ctx.beginPath();
  ctx.moveTo(tx,ty);ctx.lineTo(x,y);
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineCap="round";ctx.stroke();
  // Glow endpoint
  ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  ctx.restore();
}

function setTZ(name){
  if(!TZ[name])return;
  tz=TZ[name];lbl=name;
  if(!running){running=!0;draw()}
}
window.setTZ=setTZ;

function build(){
  if($("tool-aclock"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="aclock"]')){
    const b=document.createElement("button");b.dataset.tool="aclock";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> Jam Jakarta';
    const a=nav.querySelector('button[data-tool="ga"]')||nav.querySelector('button[data-tool="youtube"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-aclock")){
    const s=document.createElement("section");s.id="tool-aclock";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🕐 Jam Jakarta</h2><p>Jam analog real-time · smooth 60fps canvas</p></div>
      <div class="ac-wrap">
        <div class="ac-clock" id="ac-clock"><canvas id="ac-canvas"></canvas></div>
        <div class="ac-digital" id="ac-digital">--:--:--</div>
        <div class="ac-date" id="ac-date">—</div>
        <div class="ac-tz" id="ac-tz">Jakarta (WIB)</div>
      </div>
      <div class="ac-controls">${Object.keys(TZ).map(k=>`<button class="btn${k.startsWith("Jakarta")?" primary":""}" data-tz="${k}">${k}</button>`).join("")}</div>`;
    const a=ct.querySelector("#tool-ga")||ct.querySelector("#tool-youtube");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.aclock="Jam Jakarta";
  canvas=$("ac-canvas");ctx=canvas.getContext("2d");
  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="aclock"]');if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-aclock");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Jam Jakarta";
    localStorage.setItem("lastTool","aclock");
    $("sidebar")?.classList.remove("open");$("overlay")?.classList.remove("show");
    resize();if(!running){running=!0;draw()}
  });
  document.querySelectorAll("[data-tz]").forEach(b=>{
    b.addEventListener("click",()=>{
      document.querySelectorAll("[data-tz]").forEach(x=>x.classList.remove("primary"));
      b.classList.add("primary");
      setTZ(b.dataset.tz);
      if(typeof window.toast==="function")window.toast("🌍 "+b.dataset.tz,"success")
    })
  });
  window.addEventListener("resize",resize,{passive:!0});
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){running=!1;if(raf)cancelAnimationFrame(raf);raf=null}
    else if($("tool-aclock")?.classList.contains("active")){running=!0;draw()}
  });
  resize();
  if(typeof window.applyIcons==="function")window.applyIcons()
}
function boot(){if(!document.getElementById("tool-hash"))return;build()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,700));else setTimeout(boot,700);
if(window.registerTool&&!window.__reg_aclock){window.__reg_aclock=1;window.registerTool("aclock",()=>{const t=document.querySelector('button[data-tool="aclock"]');if(t)t.click()})}
})();
