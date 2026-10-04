(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
const KEY="ct_vpet_v2";
let state=null,tickTO=null,gameAct=!1;

const DEFAULT={
  name:"Mochi",hunger:80,happy:80,energy:80,health:100,age:0,coins:50,
  lastTick:Date.now(),born:Date.now(),dead:!1,
  items:{food:3,medicine:1,toy:2},
  achievements:{first_feed:!1,first_play:!1,100coins:!1,survive_1day:!1,perfect_stats:!1,all_items:!1},
  streak:0,lastVisit:Date.now()
};

const SHOP=[
  {id:"food",icon:"🍖",name:"Makanan",desc:"+30 Hunger",price:10},
  {id:"medicine",icon:"💊",name:"Obat",desc:"+40 Health",price:20},
  {id:"toy",icon:"🎾",name:"Mainan",desc:"+25 Happy",price:15},
  {id:"premium",icon:"🍰",name:"Kue Premium",desc:"+50 semua stats",price:50},
  {id:"energy",icon:"⚡",name:"Energi Drink",desc:"+50 Energy",price:15}
];

function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s)return{...DEFAULT,...s,items:{...DEFAULT.items,...s.items},achievements:{...DEFAULT.achievements,...s.achievements}}}catch(e){}return{...DEFAULT}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}

function checkAch(id,cond){
  if(!state.achievements[id]&&cond){
    state.achievements[id]=!0;
    T("🏆 Achievement: "+id.replace(/_/g," "),"success");
    state.coins+=15;
    save()
  }
}

function tick(){
  const now=Date.now();
  const dt=Math.min((now-state.lastTick)/60000,60);
  state.lastTick=now;
  state.age+=dt;
  state.hunger=Math.max(0,state.hunger-dt*1.5);
  state.happy=Math.max(0,state.happy-dt*0.8);
  state.energy=Math.max(0,state.energy-dt*1.0);
  if(state.hunger<20||state.happy<20)state.health=Math.max(0,state.health-dt*0.5);
  else if(state.hunger>60&&state.happy>60)state.health=Math.min(100,state.health+dt*0.2);
  if(state.health<=0)state.dead=!0;
  state.coins+=Math.round(dt*0.5);
  if(state.age>=1440)checkAch("survive_1day",!0);
  if(state.hunger>=99&&state.happy>=99&&state.energy>=99&&state.health>=99)checkAch("perfect_stats",!0);
  save();render()
}

function useItem(item){
  if(state.dead)return T("Pet sudah tiada 💔","error");
  if(!state.items[item]||state.items[item]<=0)return T("Item habis — beli di Shop","error");
  state.items[item]--;
  switch(item){
    case"food":state.hunger=Math.min(100,state.hunger+30);checkAch("first_feed",!0);break;
    case"medicine":state.health=Math.min(100,state.health+40);break;
    case"toy":state.happy=Math.min(100,state.happy+25);state.energy=Math.max(0,state.energy-10);checkAch("first_play",!0);break;
    case"energy":state.energy=Math.min(100,state.energy+50);break;
    case"premium":state.hunger=Math.min(100,state.hunger+50);state.happy=Math.min(100,state.happy+50);state.energy=Math.min(100,state.energy+50);break;
  }
  save();render();animate(item);T("✅ Item digunakan","success")
}

function buyItem(itemId){
  const it=SHOP.find(x=>x.id===itemId);if(!it)return;
  if(state.coins<it.price)return T("Koin tidak cukup 💰","error");
  state.coins-=it.price;
  state.items[itemId]=(state.items[itemId]||0)+1;
  if(state.coins>=100)checkAch("100coins",!0);
  save();render();T("✅ "+it.name+" dibeli!","success")
}

function mood(){
  if(state.dead)return"dead";
  if(state.hunger<25)return"hungry";
  if(state.energy<20)return"sleepy";
  if(state.happy<30)return"sad";
  if(state.health<40)return"sick";
  if(state.happy>75)return"happy";
  return"idle"
}

function animate(a){
  const pet=document.querySelector(".vp-pet");if(!pet)return;
  const cls=a==="food"?"vp-anim-eat":a==="toy"?"vp-anim-jump":a==="medicine"?"vp-anim-heal":a==="premium"?"vp-anim-jump":"vp-anim-idle";
  pet.classList.add(cls);setTimeout(()=>pet.classList.remove(cls),1200)
}

// ═══ MINIGAME — catch the ball ═══
function startGame(){
  if(gameAct)return;
  if(state.dead)return T("Pet sudah tiada","error");
  if(state.energy<10)return T("Energi tidak cukup (butuh 10)","error");
  gameAct=!0;
  const overlay=document.createElement("div");
  overlay.className="vp-game-overlay";
  overlay.innerHTML=`<div class="vp-game-box">
    <div class="vp-game-head">🎯 Catch the Ball</div>
    <div class="vp-game-stats"><span>Score: <b id="vp-g-score">0</b></span><span>Time: <b id="vp-g-time">15</b>s</span></div>
    <div class="vp-game-field" id="vp-g-field"><div class="vp-ball" id="vp-ball">🎾</div></div>
    <button class="btn" id="vp-g-cancel">Batal</button>
  </div>`;
  document.body.appendChild(overlay);
  const field=$("vp-g-field"),ball=$("vp-ball");
  let score=0,time=15;
  const moveBall=()=>{
    const fw=field.clientWidth,fh=field.clientHeight;
    ball.style.left=Math.random()*(fw-40)+"px";
    ball.style.top=Math.random()*(fh-40)+"px"
  };
  moveBall();
  ball.onclick=()=>{score++;$("vp-g-score").textContent=score;moveBall();
    if(navigator.vibrate)navigator.vibrate(30)};
  const t=setInterval(()=>{
    time--;$("vp-g-time").textContent=time;
    if(time<=0){
      clearInterval(t);
      const reward=score*3;
      state.coins+=reward;
      state.happy=Math.min(100,state.happy+score*2);
      state.energy=Math.max(0,state.energy-10);
      save();render();
      T("🎉 Score: "+score+" · +"+reward+" koin","success");
      overlay.remove();gameAct=!1
    }
  },1000);
  $("vp-g-cancel").onclick=()=>{clearInterval(t);overlay.remove();gameAct=!1};
}

const PET_SVG=`<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="vp-svg">
<defs><radialGradient id="vg1" cx="40%" cy="30%"><stop offset="0" stop-color="#ffe4f0"/><stop offset="1" stop-color="#ffb8d9"/></radialGradient><radialGradient id="vg2" cx="50%" cy="50%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e8f4ff"/></radialGradient></defs>
<ellipse cx="100" cy="175" rx="60" ry="10" fill="rgba(0,0,0,0.15)"/>
<ellipse class="vp-body" cx="100" cy="120" rx="60" ry="55" fill="url(#vg1)" stroke="#d4849f" stroke-width="2"/>
<ellipse cx="100" cy="140" rx="35" ry="35" fill="url(#vg2)" opacity="0.6"/>
<circle class="vp-ear-l" cx="60" cy="75" r="18" fill="url(#vg1)" stroke="#d4849f" stroke-width="2"/>
<circle class="vp-ear-r" cx="140" cy="75" r="18" fill="url(#vg1)" stroke="#d4849f" stroke-width="2"/>
<circle cx="60" cy="75" r="9" fill="#ffb8d9"/><circle cx="140" cy="75" r="9" fill="#ffb8d9"/>
<circle cx="100" cy="90" r="48" fill="url(#vg1)" stroke="#d4849f" stroke-width="2"/>
<g class="vp-eyes"><ellipse class="vp-eye" cx="80" cy="90" rx="8" ry="10" fill="#2c2c3c"/><ellipse class="vp-eye" cx="120" cy="90" rx="8" ry="10" fill="#2c2c3c"/>
<circle cx="83" cy="87" r="3" fill="#fff"/><circle cx="123" cy="87" r="3" fill="#fff"/></g>
<ellipse cx="70" cy="105" rx="8" ry="5" fill="#ff8fb8" opacity="0.7"/>
<ellipse cx="130" cy="105" rx="8" ry="5" fill="#ff8fb8" opacity="0.7"/>
<path class="vp-mouth" d="M 92 108 Q 100 116 108 108" stroke="#2c2c3c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<ellipse cx="100" cy="103" rx="4" ry="3" fill="#ff6b9d"/>
<circle class="vp-tail" cx="160" cy="140" r="14" fill="#ffb8d9" stroke="#d4849f" stroke-width="2"/></svg>`;

function statBar(k,v,color){const w=v<25?" vp-warn":"";return`<div class="vp-stat${w}"><div class="vp-stat-head"><span>${k}</span><span>${Math.round(v)}%</span></div><div class="vp-bar"><div class="vp-fill" style="width:${v}%;background:${color}"></div></div></div>`}

function render(){
  const el=$("vp-content");if(!el)return;
  const m=mood();
  const days=Math.floor(state.age/1440),hrs=Math.floor((state.age%1440)/60),mins=Math.floor(state.age%60);
  const totalAch=Object.values(state.achievements).filter(Boolean).length;
  el.innerHTML=`
    <div class="vp-card">
      <div class="vp-header">
        <div><div class="vp-name">${state.name}</div>
          <div class="vp-age">🎂 ${days}h ${hrs}j ${mins}m · ${m}</div>
          <div class="vp-coins">💰 ${state.coins} koin · 🏆 ${totalAch}/6</div>
        </div>
        <button class="vp-reset" id="vp-reset" title="Pet Baru">🔄</button>
      </div>
      <div class="vp-stage" data-mood="${m}">
        <div class="vp-pet ${state.dead?"vp-dead":""} ${m==="sleepy"?"vp-sleepy":""} ${m==="hungry"?"vp-hungry":""} ${m==="sad"?"vp-sad":""} ${m==="happy"?"vp-happy":""}">${PET_SVG}</div>
        ${state.dead?'<div class="vp-dead-label">💔 R.I.P.</div>':""}
      </div>
      <div class="vp-stats">
        ${statBar("🍖 Hunger",state.hunger,"linear-gradient(90deg,#f59e0b,#fbbf24)")}
        ${statBar("😊 Happy",state.happy,"linear-gradient(90deg,#ec4899,#f472b6)")}
        ${statBar("⚡ Energy",state.energy,"linear-gradient(90deg,#3b82f6,#06b6d4)")}
        ${statBar("❤️ Health",state.health,"linear-gradient(90deg,#ef4444,#f87171)")}
      </div>
      <div class="vp-actions">
        ${Object.entries(state.items).map(([k,v])=>`<button class="vp-btn vp-${k}" data-item="${k}" ${state.dead||!v?"disabled":""}>${k==="food"?"🍖":k==="medicine"?"💊":k==="toy"?"🎾":k==="energy"?"⚡":"🍰"}<span>${k} (${v||0})</span></button>`).join("")}
      </div>
      <div class="vp-actions-row">
        <button class="btn primary" id="vp-shop">🛒 Shop</button>
        <button class="btn" id="vp-game">🎯 Minigame</button>
        <button class="btn" id="vp-ach">🏆 Achievements</button>
      </div>
      <div id="vp-modal" class="vp-modal"></div>
    </div>`;
  $("vp-reset").onclick=()=>{
    if(!confirm("Mulai pet baru? Progress akan hilang."))return;
    state={...DEFAULT,lastTick:Date.now(),born:Date.now()};save();render();T("🐣 Pet baru!","success")
  };
  el.querySelectorAll(".vp-btn").forEach(b=>b.onclick=()=>useItem(b.dataset.item));
  $("vp-shop").onclick=()=>openShop();
  $("vp-game").onclick=startGame;
  $("vp-ach").onclick=openAch()
}

function openShop(){
  const el=$("vp-modal");
  el.innerHTML=`<div class="vp-modal-body">
    <div class="vp-modal-head">🛒 Pet Shop <button class="vp-modal-close">✕</button></div>
    <div class="vp-shop-coins">💰 ${state.coins} koin</div>
    <div class="vp-shop-grid">${SHOP.map(s=>`<div class="vp-shop-item">
      <div class="vp-shop-icon">${s.icon}</div>
      <div class="vp-shop-name">${s.name}</div>
      <div class="vp-shop-desc">${s.desc}</div>
      <button class="vp-shop-buy ${state.coins>=s.price?'':'disabled'}" data-id="${s.id}" ${state.coins<s.price?"disabled":""}>${s.price}💰</button>
    </div>`).join("")}</div>
  </div>`;
  el.querySelector(".vp-modal-close").onclick=()=>el.innerHTML="";
  el.querySelectorAll(".vp-shop-buy").forEach(b=>{
    if(!b.disabled)b.onclick=()=>buyItem(b.dataset.id)
  })
}

function openAch(){
  const el=$("vp-modal");
  const ACH={
    first_feed:"🍖 Pertama kali memberi makan",
    first_play:"🎾 Pertama kali mengajak main",
    "100coins":"💰 Kumpulkan 100 koin",
    survive_1day:"📅 Peluk 1 hari (1440 menit)",
    perfect_stats:"⭐ Semua stats 99%+",
    all_items:"📦 Miliki semua item sekaligus"
  };
  el.innerHTML=`<div class="vp-modal-body">
    <div class="vp-modal-head">🏆 Achievements <button class="vp-modal-close">✕</button></div>
    <div class="vp-ach-list">${Object.entries(ACH).map(([k,d])=>`<div class="vp-ach-item ${state.achievements[k]?'on':''}">
      <span class="vp-ach-check">${state.achievements[k]?"✅":"⬜"}</span>
      <span>${d}</span>
      <span class="vp-ach-reward">+15💰</span>
    </div>`).join("")}</div>
  </div>`;
  el.querySelector(".vp-modal-close").onclick=()=>el.innerHTML=""
}

function build(){
  if($("tool-vpet"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="vpet"]')){
    const b=document.createElement("button");b.dataset.tool="vpet";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg></span> Virtual Pet';
    const a=nav.querySelector('button[data-tool="slot"]');if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-vpet")){
    const s=document.createElement("section");s.id="tool-vpet";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🐣 Virtual Pet</h2><p>Pelihara · Shop · Minigame · Achievements · Auto-decay</p></div>
    <div id="vp-content"></div>`;
    ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.vpet="Virtual Pet";
  state=load();render();
  if(tickTO)clearInterval(tickTO);
  tickTO=setInterval(tick,30000)
}
if(window.registerTool)window.registerTool("vpet",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));else setTimeout(build,900);
window.VPet={state:()=>state,reset:()=>{state={...DEFAULT};save();render()}};
})();
