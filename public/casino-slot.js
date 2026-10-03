(function(){"use strict";
const $=id=>document.getElementById(id);
const toast=window.toast||(m=>console.log(m));

const SYMS=["🍒","🍋","🍊","🍇","⭐","💎","7️⃣","🔔"];
const WEIGHT={"🍒":30,"🍋":25,"🍊":18,"🍇":12,"⭐":8,"💎":4,"7️⃣":2,"🔔":1};
const PAYOUT={"🍒":3,"🍋":5,"🍊":8,"🍇":15,"⭐":30,"💎":75,"7️⃣":200,"🔔":500};

let balance=1000,bet=10,spinning=!1,bound=!1;
let stats={spins:0,biggest:0,total:0};
try{const s=JSON.parse(localStorage.getItem("ct_slot")||"null");if(s){balance=s.balance??1000;stats=s.stats||stats}}catch(e){}
const save=()=>{try{localStorage.setItem("ct_slot",JSON.stringify({balance,stats}))}catch(e){}};

// ── Fungsi tinggi reel DINAMIS (baca dari DOM) ──
function reelH(){
  const r=document.querySelector(".cs-reel");
  if(!r)return 84;
  const h=r.getBoundingClientRect().height;
  return h>10?Math.round(h):84
}

function weightedPick(){
  const total=Object.values(WEIGHT).reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(const s of SYMS){r-=WEIGHT[s];if(r<=0)return s}
  return SYMS[0]
}

function updateUI(){
  const b=$("cs-bal"),bd=$("cs-bet"),bb=$("cs-best"),disp=$("cs-bet-disp");
  if(b)b.textContent="$"+balance.toLocaleString();
  if(bd)bd.textContent="$"+bet;
  if(bb)bb.textContent="$"+stats.biggest.toLocaleString();
  if(disp)disp.textContent="$"+bet
}

function renderStatic(idxs){
  for(let i=0;i<3;i++){
    const strip=$("cs-strip-"+i);
    if(!strip)continue;
    const h=reelH();
    strip.style.transition="none";
    strip.innerHTML=SYMS[idxs[i%SYMS.length]?i:0]?Array.from({length:5},()=>`<div class="cs-sym" style="height:${h}px">${weightedPick()}</div>`).join(""):"";
    strip.style.transform="translateY(0)"
  }
}

function setInitial(){
  for(let i=0;i<3;i++){
    const strip=$("cs-strip-"+i);
    if(!strip)continue;
    const h=reelH();
    strip.style.transition="none";
    strip.innerHTML=Array.from({length:3},()=>`<div class="cs-sym" style="height:${h}px">${weightedPick()}</div>`).join("");
    strip.style.transform="translateY(0)"
  }
}

function animateReel(idx,finalSymbol,duration,delay){
  return new Promise(res=>{
    const strip=$("cs-strip-"+idx);
    if(!strip){res();return}
    const h=reelH();
    // Build panjang
    const reel=[];
    const LEN=40;
    for(let i=0;i<LEN-1;i++)reel.push(weightedPick());
    reel.push(finalSymbol);
    strip.innerHTML=reel.map(s=>`<div class="cs-sym" style="height:${h}px">${s}</div>`).join("");
    strip.style.transition="none";
    strip.style.transform="translateY(0px)";
    void strip.offsetHeight;

    const start=performance.now();
    const totalTravel=(reel.length-1)*h;
    const easeOut=t=>1-Math.pow(1-t,4);

    function tick(now){
      const el=now-start-delay;
      if(el<0){requestAnimationFrame(tick);return}
      const t=Math.min(el/duration,1);
      const y=-totalTravel*easeOut(t);
      strip.style.transform=`translateY(${y}px)`;
      if(t<1)requestAnimationFrame(tick);
      else{strip.style.transform=`translateY(${-totalTravel}px)`;res()}
    }
    requestAnimationFrame(tick)
  })
}

async function spin(){
  if(spinning)return;
  if(balance<bet)return toast("Saldo tidak cukup","error");
  spinning=!0;
  balance-=bet;save();updateUI();
  const btn=$("cs-spin");if(btn)btn.disabled=!0;
  const win=$("cs-win");if(win){win.className="cs-win";win.textContent=""}
  const final=[weightedPick(),weightedPick(),weightedPick()];
  await Promise.all([
    animateReel(0,final[0],1400,0),
    animateReel(1,final[1],1700,200),
    animateReel(2,final[2],2000,400)
  ]);
  let payout=0,desc="";
  if(final[0]===final[1]&&final[1]===final[2]){
    payout=bet*PAYOUT[final[0]];
    desc=`🎉 JACKPOT! 3× ${final[0]} = $${payout}`
  }else{
    let pairs=0;
    if(final[0]===final[1])pairs++;
    if(final[1]===final[2])pairs++;
    if(pairs>0){payout=Math.floor(bet*0.5);desc=`✨ 2 simbol sama = $${payout}`}
  }
  if(payout>0){
    balance+=payout;stats.total+=payout;
    if(payout>stats.biggest)stats.biggest=payout;
    if(win){win.className="cs-win cs-win-active";win.textContent=desc}
    for(let i=0;i<3;i++){
      const r=document.querySelector(`.cs-reel[data-r="${i}"]`);
      if(r){r.classList.add("cs-reel-win");setTimeout(()=>r.classList.remove("cs-reel-win"),1200)}
    }
    toast(desc,"success")
  }else{
    if(win){win.className="cs-win";win.textContent="Tidak ada kombinasi"}
  }
  stats.spins++;save();updateUI();
  spinning=!1;if(btn)btn.disabled=!1
}

function init(){
  if(bound)return;bound=!0;
  // Render simbol awal (setelah DOM ready)
  setTimeout(()=>{setInitial();updateUI()},100);
  const p=$("cs-plus"),m=$("cs-minus"),mx=$("cs-max"),rs=$("cs-reset"),sp=$("cs-spin");
  if(p)p.addEventListener("click",()=>{bet=Math.min(bet+10,Math.max(10,balance));updateUI()});
  if(m)m.addEventListener("click",()=>{bet=Math.max(bet-10,1);updateUI()});
  if(mx)mx.addEventListener("click",()=>{bet=Math.max(1,balance);updateUI()});
  if(rs)rs.addEventListener("click",()=>{
    if(!confirm("Reset saldo ke $1000?"))return;
    balance=1000;bet=10;stats={spins:0,biggest:0,total:0};save();updateUI();setInitial();toast("Saldo direset","success")
  });
  if(sp)sp.addEventListener("click",spin);
  // Space
  if(!window.__slotSpace){
    window.__slotSpace=1;
    document.addEventListener("keydown",e=>{
      if(e.code==="Space"&&$("tool-slot")&&$("tool-slot").classList.contains("active")){e.preventDefault();spin()}
    })
  }
  // Re-render saat resize (reel height berubah)
  window.addEventListener("resize",()=>{if($("tool-slot")&&$("tool-slot").classList.contains("active"))setInitial()},{passive:!0})
}

function build(){
  if($("tool-slot"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="slot"]')){
    const b=document.createElement("button");b.dataset.tool="slot";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="12" cy="7" r="1" fill="currentColor"/></svg></span> Slot Kasino';
    const a=nav.querySelector('button[data-tool="aclock"]')||nav.querySelector('button[data-tool="ga"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-slot")){
    const s=document.createElement("section");s.id="tool-slot";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🎰 Slot Kasino</h2><p>Mini game slot 3 reel · koin virtual (bukan uang nyata)</p></div>
    <div class="cs-notice">🎮 <strong>Simulasi:</strong> Game virtual murni untuk hiburan. Tidak ada uang nyata, tidak ada transaksi. Space = spin cepat.</div>
    <div class="cs-machine">
      <div class="cs-top">
        <div class="cs-stat"><span>Saldo</span><b id="cs-bal">$0</b></div>
        <div class="cs-stat"><span>Taruhan</span><b id="cs-bet">$10</b></div>
        <div class="cs-stat"><span>Menang terbesar</span><b id="cs-best">$0</b></div>
      </div>
      <div class="cs-reels" id="cs-reels">
        <div class="cs-reel" data-r="0"><div class="cs-strip" id="cs-strip-0"></div></div>
        <div class="cs-reel" data-r="1"><div class="cs-strip" id="cs-strip-1"></div></div>
        <div class="cs-reel" data-r="2"><div class="cs-strip" id="cs-strip-2"></div></div>
        <div class="cs-payline"></div>
      </div>
      <div class="cs-win" id="cs-win"></div>
      <div class="cs-controls">
        <button class="cs-btn-mini" id="cs-minus">−</button>
        <div class="cs-bet-display" id="cs-bet-disp">$10</div>
        <button class="cs-btn-mini" id="cs-plus">+</button>
        <button class="cs-spin" id="cs-spin">SPIN</button>
      </div>
      <div class="cs-row-btns">
        <button class="btn" id="cs-max">MAX BET</button>
        <button class="btn" id="cs-reset">⟳ Reset Saldo</button>
      </div>
      <div class="cs-payout">
        <div class="cs-payout-title">💰 Tabel Hadiah (3 sama)</div>
        <div class="cs-payout-grid">${SYMS.map(s=>`<div class="cs-pay"><span class="cs-pay-s">${s}${s}${s}</span><b>${PAYOUT[s]}x</b></div>`).join("")}</div>
        <div class="cs-payout-note">2 sama berdekatan = 0.5x taruhan · 3 sama = PAYOUT penuh</div>
      </div>
    </div>`;
    const a=ct.querySelector("#tool-aclock")||ct.querySelector("#tool-ga");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.slot="Slot Kasino"
}

if(window.registerTool)window.registerTool("slot",()=>init());
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,750));else setTimeout(build,750);
})();
