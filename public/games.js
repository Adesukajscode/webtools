(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));
let ALL=[],PAGE=1,PER=60,TOTAL=0,HASMORE=false,filterCat="all",searchQ="",loading=false;

async function api(page,q,cat){
  const params=new URLSearchParams({page,per:PER});
  if(q)params.set("q",q);
  if(cat&&cat!=="all")params.set("cat",cat);
  const r=await fetch("/api/games?"+params);
  if(!r.ok)throw new Error("HTTP "+r.status);
  const d=await r.json();
  if(!d.ok)throw new Error(d.error||"failed");
  return d
}

function renderGrid(games,append){
  const el=$("ga-grid");
  if(!el)return;
  if(!append&&!games.length){el.innerHTML='<div class="ga-empty">😢 Tidak ada game</div>';return}
  const html=games.map(g=>`
    <div class="ga-card" data-id="${esc(g.id)}">
      <div class="ga-thumb">
        <div class="ga-thumb-bg"></div>
        ${g.thumb?`<img src="${esc(g.thumb)}" alt="${esc(g.title)}" loading="lazy" onerror="this.style.display='none'">`:""}
        <div class="ga-play-overlay"><div class="ga-play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg></div></div>
        <div class="ga-badge">${esc((g.provider||"game").slice(0,10))}</div>
      </div>
      <div class="ga-card-body">
        <div class="ga-title">${esc(g.title)}</div>
        <div class="ga-cat"><span class="ga-cat-dot"></span>${esc(g.cat)}</div>
      </div>
    </div>
  `).join("");
  if(append)el.insertAdjacentHTML("beforeend",html);
  else el.innerHTML=html;
  el.querySelectorAll(".ga-card:not(.bound)").forEach(c=>{
    c.classList.add("bound");
    c.addEventListener("click",()=>{
      const g=ALL.find(x=>x.id===c.dataset.id);
      if(g)playGame(g)
    })
  })
}

function playGame(g){
  const wrap=$("ga-player-wrap"),empty=$("ga-player-empty");
  if(!wrap)return;
  wrap.innerHTML=`<iframe src="${esc(g.url)}" title="${esc(g.title)}" frameborder="0" allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope" allowfullscreen></iframe>`;
  wrap.style.display="block";
  if(empty)empty.style.display="none";
  const t=$("ga-current-title");if(t)t.textContent=g.title;
  const m=$("ga-current-meta");if(m)m.textContent=(g.provider||"")+" · "+g.cat;
  $("ga-player-shell")?.scrollIntoView({behavior:"smooth",block:"start"});
  toast("🎮 "+g.title,"success")
}

function closePlayer(){
  const wrap=$("ga-player-wrap"),empty=$("ga-player-empty");
  if(wrap){wrap.innerHTML="";wrap.style.display="none"}
  if(empty)empty.style.display="flex"
}
function fullscreen(){
  const shell=$("ga-player-shell");if(!shell)return;
  try{if(document.fullscreenElement)document.exitFullscreen();else shell.requestFullscreen?.()}catch(e){}
}

async function load(reset){
  if(loading)return;
  loading=true;
  const grid=$("ga-grid"),more=$("ga-more");
  if(reset){
    PAGE=1;ALL=[];
    if(grid)grid.innerHTML='<div class="ga-loading">⏳ Memuat game...</div>';
    if(more)more.style.display="none";
  }else if(more){
    more.textContent="⏳ Memuat halaman "+(PAGE+1)+"..."
  }
  try{
    const d=await api(PAGE,searchQ,filterCat);
    ALL=reset?d.games:[...ALL,...d.games];
    TOTAL=d.total;HASMORE=d.hasMore;
    const src=$("ga-src");if(src)src.textContent="source: "+(d.source||"?");
    const cnt=$("ga-count");if(cnt)cnt.textContent=`${ALL.length} / ${TOTAL} game`;
    renderGrid(d.games,!reset);
    // build category chips (sekali)
    const cats=$("ga-cats");
    if(cats&&!cats.dataset.built&&d.categories){
      cats.dataset.built="1";
      const list=["all",...d.categories];
      cats.innerHTML=list.map(k=>`<button class="ga-cat-chip ${k==="all"?"active":""}" data-cat="${esc(k)}">${k==="all"?"🎯 Semua":esc(k)}</button>`).join("");
      cats.querySelectorAll(".ga-cat-chip").forEach(ch=>{
        ch.addEventListener("click",()=>{
          cats.querySelectorAll(".ga-cat-chip").forEach(x=>x.classList.remove("active"));
          ch.classList.add("active");
          filterCat=ch.dataset.cat;
          load(!0)
        })
      })
    }
    // show more button
    if(more){
      more.style.display=HASMORE?"inline-flex":"none";
      more.textContent=`▼ Muat ${Math.min(PER,TOTAL-ALL.length)} game lagi`
    }
  }catch(e){
    if(reset&&grid)grid.innerHTML='<div class="ga-empty">❌ '+esc(e.message)+'</div>';
    toast("Gagal: "+e.message,"error")
  }finally{loading=false}
}

// ═══ BUILD UI ═══
function build(){
  if($("tool-ga"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="ga"]')){
    const b=document.createElement("button");b.dataset.tool="ga";
    b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="12" rx="4"/><line x1="5" y1="13" x2="9" y2="13"/><line x1="7" y1="11" x2="7" y2="15"/><circle cx="15.5" cy="12" r="1.2" fill="currentColor"/><circle cx="17.5" cy="14" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15.5" r="1.2" fill="currentColor"/><line x1="9" y1="3.5" x2="9" y2="7"/><line x1="15" y1="3.5" x2="15" y2="7"/><line x1="7" y1="3.5" x2="11" y2="3.5"/><line x1="13" y1="3.5" x2="17" y2="3.5"/></svg></span> Game Arcade`;
    const anchor=nav.querySelector('button[data-tool="youtube"]')||nav.querySelector('button[data-tool="hands"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-ga")){
    const s=document.createElement("section");s.id="tool-ga";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>🎮 Game Arcade</h2><p>1000+ game HTML5 gratis dari GameMonetize + iDev.Games</p></div>
      <div class="ga-notice">🎮 <strong>Powered by:</strong> GameMonetize + iDev.Games. Auto-load halaman berikutnya saat scroll.</div>
      <div class="ga-search-row">
        <span class="ga-search-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input type="text" id="ga-search" placeholder="Cari game... (slope, tetris, subway, vex)" autocomplete="off">
        <button class="btn primary" id="ga-refresh" title="Refresh"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
      </div>
      <div class="ga-cats" id="ga-cats"></div>
      <div class="ga-count-row"><span id="ga-count">0 game</span><span class="ga-src" id="ga-src"></span></div>
      <div class="ga-player-shell" id="ga-player-shell">
        <div class="ga-player-header">
          <div class="ga-player-info">
            <div class="ga-current-title" id="ga-current-title">Pilih game untuk mulai</div>
            <div class="ga-current-meta" id="ga-current-meta"></div>
          </div>
          <div class="ga-player-actions">
            <button class="btn" id="ga-full" title="Fullscreen"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></button>
            <button class="btn" id="ga-close" title="Tutup"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>
        <div class="ga-player-body">
          <div class="ga-player-empty" id="ga-player-empty"><div class="ga-empty-icon">🕹️</div><div>Klik game untuk mulai</div></div>
          <div class="ga-player-wrap" id="ga-player-wrap"></div>
        </div>
      </div>
      <div class="ga-grid" id="ga-grid"><div class="ga-loading">⏳ Memuat...</div></div>
      <div class="ga-more-wrap"><button class="btn" id="ga-more" style="display:none">▼ Muat lebih banyak</button></div>
    `;
    const anchor=ct.querySelector("#tool-youtube")||ct.querySelector("#tool-hands");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.ga="Game Arcade";
  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="ga"]');if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-ga");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Game Arcade";
    localStorage.setItem("lastTool","ga");
    $("sidebar")?.classList.remove("open");$("overlay")?.classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind()}
  });
  if(typeof window.applyIcons==="function")window.applyIcons()
}

function bind(){
  let tmr=null;
  $("ga-search").addEventListener("input",()=>{clearTimeout(tmr);tmr=setTimeout(()=>{searchQ=$("ga-search").value.trim();load(!0)},300)});
  $("ga-refresh").addEventListener("click",()=>{searchQ="";filterCat="all";$("ga-search").value="";document.querySelectorAll(".ga-cat-chip").forEach(x=>x.classList.remove("active"));$("ga-cats")?.querySelector('[data-cat="all"]')?.classList.add("active");load(!0)});
  $("ga-full").addEventListener("click",fullscreen);
  $("ga-close").addEventListener("click",closePlayer);
  $("ga-more").addEventListener("click",()=>{PAGE++;load(false)});
  // Infinite scroll
  const content=document.querySelector(".content");
  if(content&&!content.dataset.gaScroll){
    content.dataset.gaScroll="1";
    content.addEventListener("scroll",()=>{
      if(!HASMORE||loading)return;
      if(!$("tool-ga")?.classList.contains("active"))return;
      const near=content.scrollTop+content.clientHeight>content.scrollHeight-400;
      if(near){PAGE++;load(false)}
    })
  }
  load(true)
}

function boot(){if(!document.getElementById("tool-hash"))return;build()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,700));else setTimeout(boot,700);
})();
