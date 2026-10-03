(function(){"use strict";
const $=id=>document.getElementById(id);
const toast=window.toast||(m=>console.log(m));

const SYMS=["🍒","🍋","🍊","🍇","⭐","💎","7️⃣","🔔"];
// weight: makin tinggi makin sering muncul (tapi makin kecil hadiahnya)
const WEIGHT={ "🍒":30,"🍋":25,"🍊":18,"🍇":12,"⭐":8,"💎":4,"7️⃣":2,"🔔":1 };
const PAYOUT={ "🍒":3,"🍋":5,"🍊":8,"🍇":15,"⭐":30,"💎":75,"7️⃣":200,"🔔":500 };

let balance=1000,bet=10,spinning=!1,reelState=[0,0,0],stats={ spins:0,biggest:0,total:0 };
try{const s=JSON.parse(localStorage.getItem("ct_slot")||"null");if(s){balance=s.balance??1000;stats=s.stats||stats}}catch(e){}
const save=()=>{try{localStorage.setItem("ct_slot",JSON.stringify({balance,stats}))}catch(e){}};

function weightedPick(){
  const total=Object.values(WEIGHT).reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(const s of SYMS){r-=WEIGHT[s];if(r<=0)return s}
  return SYMS[0]
}

function buildReel(){
  // reel panjang untuk animasi scroll
  const arr=[];
  for(let i=0;i<40;i++)arr.push(weightedPick());
  return arr
}

function build(){
  if($("tool-slot"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="slot"]')){
    const b=document.createElement("button");b.dataset.tool="slot";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="12" cy="7" r="1" fill="currentColor"/></svg></span> Slot Kasino';
    const a=nav.querySelector('button[data-tool="aclock"]')||nav.querySelector('button[data-tool="ga"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-slot")){
    const s=document.createElement("section");s.id="tool-slot";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🎰 Slot Kasino</h2><p>Mini game slot 3 reel · simulasi koin virtual (bukan uang nyata)</p></div>
      <div class="cs-notice">🎮 <strong>Simulasi:</strong> Ini game virtual murni untuk hiburan. Tidak ada uang nyata, tidak ada transaksi. Saldo reset dengan tombol ⟳.</div>
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
  if(window.TOOL_TITLES)window.TOOL_TITLES.slot="Slot Kasino";
  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="slot"]');if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-slot");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Slot Kasino";
    localStorage.setItem("lastTool","slot");
    $("sidebar")?.classList.remove("open");$("overlay")?.classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";init()}
  });
  if(typeof window.applyIcons==="function")window.applyIcons()
}

function symHeight(){return 84}

function renderReel(idx,symbols,offset=0){
  const strip=$("cs-strip-"+idx);
  if(!strip)return;
  const h=symHeight();
  strip.style.transform=`translateY(${-offset*h}px)`;
  if(strip.children.length!==symbols.length){
    strip.innerHTML=symbols.map(s=>`<div class="cs-sym">${s}</div>`).join("")
  }
}

function setSymbols(symbols){
  for(let i=0;i<3;i++)renderReel(i,symbols[i],0)
}

async function spin(){
  if(spinning)return;
  if(balance<bet)return toast("Saldo tidak cukup","error");
  spinning=!0;balance-=bet;save();updateUI();
  const spinBtn=$("cs-spin");if(spinBtn)spinBtn.disabled=!0;
  // clear win
  const win=$("cs-win");if(win){win.className="cs-win";win.textContent=""}
  // hasil final
  const final=[weightedPick(),weightedPick(),weightedPick()];
  // Animasikan tiap reel sequential
  const delays=[0,200,400];
  const durations=[1400,1700,2000];
  await Promise.all([0,1,2].map(i=>animateReel(i,final[i],durations[i],delays[i])));
  // hitung kemenangan
  let payout=0,desc="";
  if(final[0]===final[1]&&final[1]===final[2]){
    payout=bet*PAYOUT[final[0]];
    desc=`🎉 JACKPOT! 3× ${final[0]} = $${payout}`
  }else{
    // 2 sama berdekatan
    let pairs=0;
    if(final[0]===final[1])pairs++;
    if(final[1]===final[2])pairs++;
    if(pairs>0){payout=Math.floor(bet*0.5);desc=`✨ 2 simbol sama = $${payout}`}
  }
  if(payout>0){
    balance+=payout;stats.total+=payout;
    if(payout>stats.biggest)stats.biggest=payout;
    if(win){win.className="cs-win cs-win-active";win.textContent=desc}
    // glow reel yang menang
    for(let i=0;i<3;i++){const r=document.querySelector(`.cs-reel[data-r="${i}"]`);if(r){r.classList.add("cs-reel-win");setTimeout(()=>r.classList.remove("cs-reel-win"),1200)}}
    toast(desc,"success")
  }else{
    if(win){win.className="cs-win";win.textContent="Tidak ada kombinasi"}
  }
  stats.spins++;save();updateUI();
  spinning=!1;if(spinBtn)spinBtn.disabled=!1;
}

function animateReel(idx,finalSymbol,duration,delay){
  return new Promise(res=>{
    const strip=$("cs-strip-"+idx);
    if(!strip){res();return}
    const h=symHeight();
    // Build long reel: 40 random + final di posisi 39
    const reel=[];
    for(let i=0;i<39;i++)reel.push(weightedPick());
    reel.push(finalSymbol);
    strip.innerHTML=reel.map(s=>`<div class="cs-sym">${s}</div>`).join("");
    strip.style.transition="none";
    strip.style.transform="translateY(0px)";
    void strip.offsetHeight; // reflow

    const start=performance.now();
    const totalTravel=(reel.length-1)*h;
    const easeOut=t=>1-Math.pow(1-t,4); // easeOutQuart

    function tick(now){
      const elapsed=now-start-delay;
      if(elapsed<0){requestAnimationFrame(tick);return}
      const t=Math.min(elapsed/duration,1);
      const eased=easeOut(t);
      const y=-totalTravel*eased;
      strip.style.transform=`translateY(${y}px)`;
      if(t<1){requestAnimationFrame(tick)}
      else{
        strip.style.transform=`translateY(${-totalTravel}px)`;
        res()
      }
    }
    requestAnimationFrame(tick)
  })
}

function updateUI(){
  const b=$("cs-bal"),bd=$("cs-bet"),bb=$("cs-best");
  if(b)b.textContent="$"+balance.toLocaleString();
  if(bd)bd.textContent="$"+bet;
  if(bb)bb.textContent="$"+stats.biggest.toLocaleString();
  const bdisp=$("cs-bet-disp");if(bdisp)bdisp.textContent="$"+bet;
}

function init(){
  // tampilkan simbol awal
  setSymbols([weightedPick(),weightedPick(),weightedPick()]);
  updateUI();

  $("cs-plus")?.addEventListener("click",()=>{bet=Math.min(bet+10,balance);if(bet<1)bet=10;updateUI()});
  $("cs-minus")?.addEventListener("click",()=>{bet=Math.max(bet-10,1);updateUI()});
  $("cs-max")?.addEventListener("click",()=>{bet=Math.max(1,balance);updateUI()});
  $("cs-reset")?.addEventListener("click",()=>{
    if(!confirm("Reset saldo ke $1000?"))return;
    balance=1000;bet=10;stats={spins:0,biggest:0,total:0};save();updateUI();toast("Saldo direset","success")
  });
  $("cs-spin")?.addEventListener("click",spin);

  // Spacebar untuk spin
  document.addEventListener("keydown",e=>{
    if(e.code==="Space"&&$("tool-slot")?.classList.contains("active")){
      e.preventDefault();spin()
    }
  });
}

function boot(){if(!document.getElementById("tool-hash"))return;build()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,800));else setTimeout(boot,800);
})();
