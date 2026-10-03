(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));
const CACHE_KEY="ct_games_cache";
let ALL=[],CURRENT=null,filterCat="all";

// ═══ FETCH ═══
async function fetchGames(force){
  if(!force){
    try{
      const c=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
      if(c&&Date.now()-c.ts<1000*60*60*6){return c}
    }catch(e){}
  }
  const r=await fetch("/api/games?limit=200");
  if(!r.ok)throw new Error("HTTP "+r.status);
  const d=await r.json();
  if(!d.ok)throw new Error(d.error||"failed");
  const cache={list:d.games,ts:Date.now(),cats:d.categories,source:d.source};
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch(e){}
  return cache
}

// ═══ RENDER GRID ═══
function renderGrid(games){
  const el=$("ga-grid");
  if(!el)return;
  if(!games.length){el.innerHTML='<div class="ga-empty">😢 Tidak ada game ditemukan</div>';return}
  el.innerHTML=games.map(g=>`
    <div class="ga-card" data-id="${esc(g.id)}">
      <div class="ga-thumb">
        ${g.thumb?`<img src="${esc(g.thumb)}" alt="${esc(g.title)}" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.ga-ph').style.display='flex'">`:""}
        <div class="ga-ph" style="${g.thumb?"display:none":""}">🎮</div>
        <div class="ga-play-overlay"><span>▶ Main</span></div>
      </div>
      <div class="ga-card-body">
        <div class="ga-title">${esc(g.title)}</div>
        <div class="ga-cat">${esc(g.cat)}</div>
      </div>
    </div>
  `).join("");
  el.querySelectorAll(".ga-card").forEach(c=>{
    c.addEventListener("click",()=>{
      const g=ALL.find(x=>x.id===c.dataset.id);
      if(g)playGame(g)
    })
  })
}

// ═══ FILTER ═══
function filter(){
  const q=($("ga-search")?.value||"").toLowerCase().trim();
  let list=ALL;
  if(q)list=list.filter(g=>g.title.toLowerCase().includes(q)||g.cat.includes(q));
  if(filterCat!=="all")list=list.filter(g=>g.cat.includes(filterCat));
  renderGrid(list);
  const cnt=$("ga-count");if(cnt)cnt.textContent=`${list.length} game`
}

// ═══ PLAY ═══
function playGame(g){
  CURRENT=g;
  const wrap=$("ga-player-wrap");
  const empty=$("ga-player-empty");
  if(!wrap)return;
  wrap.innerHTML=`<iframe
    src="${esc(g.url)}"
    title="${esc(g.title)}"
    frameborder="0"
    allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
    allowfullscreen
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-orientation-lock"
  ></iframe>`;
  wrap.style.display="block";
  if(empty)empty.style.display="none";
  const title=$("ga-current-title");if(title)title.textContent=g.title;
  const meta=$("ga-current-meta");if(meta)meta.textContent=(g.provider||"")+" · "+g.cat;
  const shell=$("ga-player-shell");
  if(shell)shell.scrollIntoView({behavior:"smooth",block:"start"});
  toast("🎮 "+g.title,"success");
}

function closePlayer(){
  const wrap=$("ga-player-wrap"),empty=$("ga-player-empty");
  if(wrap){wrap.innerHTML="";wrap.style.display="none"}
  if(empty)empty.style.display="flex";
  CURRENT=null;
}

// ═══ FULLSCREEN ═══
function fullscreen(){
  const shell=$("ga-player-shell");
  if(!shell)return;
  try{
    if(document.fullscreenElement)document.exitFullscreen();
    else shell.requestFullscreen&&shell.requestFullscreen()
  }catch(e){toast("Fullscreen error","error")}
}

// ═══ BUILD UI ═══
function build(){
  if($("tool-ga"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;

  if(!nav.querySelector('button[data-tool="ga"]')){
    const b=document.createElement("button");b.dataset.tool="ga";
    b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="3"/></svg></span> Game Arcade`;
    const anchor=nav.querySelector('button[data-tool="youtube"]')||nav.querySelector('button[data-tool="hands"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)
  }

  if(!$("tool-ga")){
    const s=document.createElement("section");s.id="tool-ga";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>Game Arcade</h2><p>Main ratusan game HTML5 gratis — ketik nama game atau pilih dari grid</p></div>
      <div class="ga-notice">🎮 <strong>Powered by:</strong> GameMonetize + iDev.Games (publisher embed resmi). Game diputar via iframe langsung dari server mereka — legal & gratis.</div>
      <div class="ga-search-row">
        <span class="ga-search-icon">🔍</span>
        <input type="text" id="ga-search" placeholder="Cari game... (misal: vex, slope, tetris, subway)" autocomplete="off">
        <button class="btn primary" id="ga-refresh" title="Refresh daftar game">🔄</button>
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
            <button class="btn" id="ga-full" title="Fullscreen">⛶</button>
            <button class="btn" id="ga-close" title="Tutup">✕</button>
          </div>
        </div>
        <div class="ga-player-body">
          <div class="ga-player-empty" id="ga-player-empty">
            <div class="ga-empty-icon">🕹️</div>
            <div>Klik game di bawah untuk mulai</div>
          </div>
          <div class="ga-player-wrap" id="ga-player-wrap"></div>
        </div>
      </div>
      <div class="ga-grid" id="ga-grid">
        <div class="ga-loading">⏳ Memuat daftar game...</div>
      </div>
    `;
    const anchor=ct.querySelector("#tool-youtube")||ct.querySelector("#tool-hands");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)
  }

  if(window.TOOL_TITLES)window.TOOL_TITLES.ga="Game Arcade";

  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="ga"]');
    if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-ga");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Game Arcade";
    localStorage.setItem("lastTool","ga");
    $("sidebar")&&$("sidebar").classList.remove("open");
    $("overlay")&&$("overlay").classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind()}
  });

  if(typeof window.applyIcons==="function")window.applyIcons()
}

function bind(){
  // search (debounce)
  let tmr=null;
  $("ga-search").addEventListener("input",()=>{
    clearTimeout(tmr);tmr=setTimeout(filter,150)
  });
  // refresh
  $("ga-refresh").addEventListener("click",async()=>{
    localStorage.removeItem(CACHE_KEY);
    await load(!0)
  });
  // fullscreen + close
  $("ga-full").addEventListener("click",fullscreen);
  $("ga-close").addEventListener("click",closePlayer);
  // initial load
  load(false)
}

async function load(force){
  const grid=$("ga-grid");
  if(grid&&(!ALL.length||force))grid.innerHTML='<div class="ga-loading">⏳ Memuat game...</div>';
  try{
    const c=await fetchGames(force);
    ALL=c.list||[];
    const src=$("ga-src");if(src)src.textContent="source: "+(c.source||"?");
    // build category chips
    const cats=$("ga-cats");
    if(cats&&!cats.dataset.built){
      cats.dataset.built="1";
      const all=["all",...((c.cats||[]).slice(0,12))];
      cats.innerHTML=all.map(k=>`<button class="ga-cat-chip ${k==="all"?"active":""}" data-cat="${esc(k)}">${k==="all"?"Semua":esc(k)}</button>`).join("");
      cats.querySelectorAll(".ga-cat-chip").forEach(ch=>{
        ch.addEventListener("click",()=>{
          cats.querySelectorAll(".ga-cat-chip").forEach(x=>x.classList.remove("active"));
          ch.classList.add("active");
          filterCat=ch.dataset.cat;
          filter()
        })
      })
    }
    filter()
  }catch(e){
    if(grid)grid.innerHTML='<div class="ga-empty">❌ Gagal load: '+esc(e.message)+'<br><button class="btn" onclick="location.reload()">Retry</button></div>';
    toast("Gagal load game: "+e.message,"error")
  }
}

function boot(){
  if(!document.getElementById("tool-hash"))return;
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,650));else setTimeout(boot,650);
})();
