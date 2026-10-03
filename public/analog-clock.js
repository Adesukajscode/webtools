(function(){"use strict";
const $=id=>document.getElementById(id);
const toast=window.toast||(m=>console.log(m));

let rafId=null,running=false,timezone="Asia/Jakarta",label="Jakarta (WIB)";

// ═══ GET TIME IN SPECIFIC TIMEZONE ═══
function getTZParts(tz){
  const fmt=new Intl.DateTimeFormat("en-US",{
    timeZone:tz,
    hour12:false,
    hour:"numeric",minute:"numeric",second:"numeric",
    weekday:"long",year:"numeric",month:"long",day:"numeric"
  });
  const parts=fmt.formatToParts(new Date());
  const o={};
  parts.forEach(p=>o[p.type]=p.value);
  return{
    hour:parseInt(o.hour,10)%24,
    minute:parseInt(o.minute,10),
    second:parseInt(o.second,10),
    ms:Date.now()%1000,
    weekday:o.weekday,
    day:parseInt(o.day,10),
    month:o.month,
    year:parseInt(o.year,10)
  }
}

// ═══ SVG CLOCK FACE ═══
function buildFace(){
  const size=280,cx=size/2,cy=size/2;
  let marks="";
  // Jam marks + angka
  for(let i=0;i<12;i++){
    const angle=(i*30-90)*Math.PI/180;
    const r1=size/2-18,r2=size/2-8;
    const x1=cx+Math.cos(angle)*r1,y1=cy+Math.sin(angle)*r1;
    const x2=cx+Math.cos(angle)*r2,y2=cy+Math.sin(angle)*r2;
    marks+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${i%3===0?3:1.5}" stroke-linecap="round" opacity="${i%3===0?1:0.5}"/>`;
  }
  // Menit marks (60)
  for(let i=0;i<60;i++){
    if(i%5===0)continue;
    const angle=(i*6-90)*Math.PI/180;
    const r1=size/2-10,r2=size/2-6;
    const x1=cx+Math.cos(angle)*r1,y1=cy+Math.sin(angle)*r1;
    const x2=cx+Math.cos(angle)*r2,y2=cy+Math.sin(angle)*r2;
    marks+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1" opacity="0.25"/>`;
  }
  // Angka
  let nums="";
  for(let i=1;i<=12;i++){
    const angle=(i*30-90)*Math.PI/180;
    const r=size/2-34;
    const x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r+4;
    nums+=`<text x="${x}" y="${y}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" font-family="Inter,system-ui,sans-serif">${i}</text>`;
  }
  return`<svg viewBox="0 0 ${size} ${size}" class="ac-svg">
    <defs>
      <radialGradient id="acFace" cx="50%" cy="30%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.06)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
      </radialGradient>
      <filter id="acGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${size/2-4}" fill="url(#acFace)" stroke="currentColor" stroke-width="2" opacity="0.6"/>
    <circle cx="${cx}" cy="${cy}" r="${size/2-14}" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>
    <g class="ac-marks">${marks}</g>
    <g class="ac-nums">${nums}</g>
    <line class="ac-hour" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-70}" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <line class="ac-min" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-95}" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <line class="ac-sec" x1="${cx}" y1="${cy+10}" x2="${cx}" y2="${cy-105}" stroke="#ef4444" stroke-width="2" stroke-linecap="round" filter="url(#acGlow)"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="currentColor"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="#ef4444"/>
  </svg>`
}

// ═══ UPDATE HANDS (real-time rotation) ═══
function updateHands(){
  if(!running)return;
  const t=getTZParts(timezone);
  const secAng=(t.second+t.ms/1000)*6;      // 6° per detik
  const minAng=(t.minute+t.second/60)*6;    // 6° per menit
  const hrAng=(t.hour%12+t.minute/60)*30;   // 30° per jam

  const svg=document.querySelector("#ac-clock .ac-svg");
  if(!svg)return;
  const hourEl=svg.querySelector(".ac-hour");
  const minEl=svg.querySelector(".ac-min");
  const secEl=svg.querySelector(".ac-sec");
  const cx=140,cy=140;
  // rotation around center
  hourEl.setAttribute("transform",`rotate(${hrAng} ${cx} ${cy})`);
  minEl.setAttribute("transform",`rotate(${minAng} ${cx} ${cy})`);
  secEl.setAttribute("transform",`rotate(${secAng} ${cx} ${cy})`);

  // Digital display
  const dEl=$("ac-digital");
  if(dEl){
    const hh=String(t.hour).padStart(2,"0");
    const mm=String(t.minute).padStart(2,"0");
    const ss=String(t.second).padStart(2,"0");
    dEl.textContent=`${hh}:${mm}:${ss}`
  }
  const dateEl=$("ac-date");
  if(dateEl){
    dateEl.textContent=`${t.weekday}, ${t.day} ${t.month} ${t.year}`
  }
  const tzEl=$("ac-tz");
  if(tzEl){
    tzEl.textContent=label
  }

  rafId=requestAnimationFrame(updateHands);
}

// ═══ BUILD UI ═══
function build(){
  if($("tool-aclock"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;

  if(!nav.querySelector('button[data-tool="aclock"]')){
    const b=document.createElement("button");b.dataset.tool="aclock";
    b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> Jam Jakarta`;
    const anchor=nav.querySelector('button[data-tool="ga"]')||nav.querySelector('button[data-tool="youtube"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)
  }

  if(!$("tool-aclock")){
    const s=document.createElement("section");s.id="tool-aclock";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>🕐 Jam Jakarta</h2><p>Jam analog real-time Waktu Indonesia Barat (WIB / Asia/Jakarta)</p></div>
      <div class="ac-wrap">
        <div class="ac-clock" id="ac-clock">${buildFace()}</div>
        <div class="ac-digital" id="ac-digital">--:--:--</div>
        <div class="ac-date" id="ac-date">—</div>
        <div class="ac-tz" id="ac-tz">Jakarta (WIB)</div>
      </div>
      <div class="ac-controls">
        <button class="btn primary" data-tz="Asia/Jakarta" data-lbl="Jakarta (WIB)">🇮🇩 Jakarta WIB</button>
        <button class="btn" data-tz="Asia/Makassar" data-lbl="Makassar (WITA)">🇮🇩 Makassar WITA</button>
        <button class="btn" data-tz="Asia/Jayapura" data-lbl="Jayapura (WIT)">🇮🇩 Jayapura WIT</button>
        <button class="btn" data-tz="Asia/Singapore" data-lbl="Singapore (SGT)">🇸🇬 Singapore</button>
        <button class="btn" data-tz="Asia/Tokyo" data-lbl="Tokyo (JST)">🇯🇵 Tokyo</button>
        <button class="btn" data-tz="Europe/London" data-lbl="London (GMT)">🇬🇧 London</button>
        <button class="btn" data-tz="America/New_York" data-lbl="New York (EST)">🇺🇸 New York</button>
        <button class="btn" data-tz="UTC" data-lbl="UTC">🌍 UTC</button>
      </div>
    `;
    const anchor=ct.querySelector("#tool-ga")||ct.querySelector("#tool-youtube");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)
  }

  if(window.TOOL_TITLES)window.TOOL_TITLES.aclock="Jam Jakarta";

  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="aclock"]');
    if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-aclock");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Jam Jakarta";
    localStorage.setItem("lastTool","aclock");
    $("sidebar")?.classList.remove("open");
    $("overlay")?.classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind()}
    // auto-start
    if(!running){running=true;updateHands()}
  });

  if(typeof window.applyIcons==="function")window.applyIcons()
}

function bind(){
  // Timezone switcher
  document.querySelectorAll(".ac-controls .btn").forEach(b=>{
    b.addEventListener("click",()=>{
      document.querySelectorAll(".ac-controls .btn").forEach(x=>x.classList.remove("primary"));
      b.classList.add("primary");
      timezone=b.dataset.tz;
      label=b.dataset.lbl;
      toast("🌍 "+label,"success");
      // restart animasi
      running=false;
      if(rafId)cancelAnimationFrame(rafId);
      running=true;updateHands()
    })
  });
  // start
  if(!running){running=true;updateHands()}
}

function boot(){
  if(!document.getElementById("tool-hash"))return;
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,750));else setTimeout(boot,750);

// Pause saat tab tidak aktif (hemat CPU)
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    running=false;
    if(rafId)cancelAnimationFrame(rafId)
  }else{
    if($("tool-aclock")?.classList.contains("active")){
      running=true;updateHands()
    }
  }
});
})();
