(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));

// ═══ EXTRACT VIDEO ID ═══
function extractID(input){
  if(!input)return null;
  const s=input.trim();
  // live URL: youtube.com/live/VIDEOID
  let m=s.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);if(m)return{id:m[1],type:"live"};
  // watch?v=
  m=s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);if(m)return{id:m[1],type:"video"};
  // youtu.be/
  m=s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);if(m)return{id:m[1],type:"video"};
  // shorts
  m=s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);if(m)return{id:m[1],type:"shorts"};
  // embed
  m=s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);if(m)return{id:m[1],type:"video"};
  // playlist
  m=s.match(/[?&]list=([a-zA-Z0-9_-]+)/);if(m)return{playlist:m[1],type:"playlist"};
  // raw ID (11 chars)
  if(/^[a-zA-Z0-9_-]{11}$/.test(s))return{id:s,type:"video"};
  return null
}

// ═══ BUILD PLAYER HTML ═══
function buildPlayer(id,type){
  const params=new URLSearchParams({
    autoplay:"1",
    rel:"0",
    modestbranding:"1",
    playsinline:"1",
    enablejsapi:"1"
  });
  let src="";
  if(type==="playlist"){
    src=`https://www.youtube.com/embed/videoseries?list=${id}&${params}`
  }else{
    src=`https://www.youtube.com/embed/${id}?${params}`
  }
  return src
}

// ═══ HISTORY ═══
const HISTORY_KEY="ct_yt_history";
function loadHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]")}catch(e){return[]}}
function saveHistory(list){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(list.slice(0,20)))}catch(e){}}
function addHistory(item){
  const list=loadHistory().filter(x=>x.id!==item.id);
  list.unshift(item);
  saveHistory(list);
  renderHistory()
}
function renderHistory(){
  const el=$("yt-history");
  if(!el)return;
  const list=loadHistory();
  if(!list.length){el.innerHTML='<div class="yt-history-empty">Belum ada riwayat</div>';return}
  el.innerHTML=list.map(h=>`
    <button class="yt-history-item" data-id="${esc(h.id)}" data-type="${esc(h.type)}">
      <span class="yt-history-type">${h.type==="live"?"🔴 LIVE":h.type==="playlist"?"📋 PLAYLIST":h.type==="shorts"?"⚡ SHORTS":"🎬 VIDEO"}</span>
      <span class="yt-history-label">${esc(h.label||h.id)}</span>
      <span class="yt-history-close" data-del="${esc(h.id)}">✕</span>
    </button>
  `).join("")
}

// ═══ LOAD & PLAY ═══
function play(input,label){
  const parsed=extractID(input);
  if(!parsed)return toast("URL YouTube tidak valid","error");
  const key=parsed.id||parsed.playlist;
  const src=buildPlayer(key,parsed.type);
  const wrap=$("yt-player-wrap");
  const empty=$("yt-empty");
  if(wrap){
    wrap.innerHTML=`<iframe
      id="yt-iframe"
      src="${src}"
      title="YouTube player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>`;
    wrap.style.display="block"
  }
  if(empty)empty.style.display="none";
  addHistory({id:key,type:parsed.type,label:label||key,ts:Date.now()});
  toast(parsed.type==="live"?"Memutar LIVE stream":"Memutar video","success")
}

// ═══ BUILD UI ═══
function build(){
  if($("tool-youtube"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;

  if(!nav.querySelector('button[data-tool="youtube"]')){
    const b=document.createElement("button");b.dataset.tool="youtube";
    b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/></svg></span> YouTube Player`;
    const anchor=nav.querySelector('button[data-tool="dl"]')||nav.querySelector('button[data-tool="hands"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)
  }

  if(!$("tool-youtube")){
    const s=document.createElement("section");s.id="tool-youtube";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>YouTube Player</h2><p>Putar video, live streaming, shorts & playlist YouTube langsung dari browser — legal via IFrame API resmi</p></div>
      <div class="yt-notice">✅ <strong>Legal:</strong> Video diputar langsung dari server YouTube. Creator tetap dapat view count & monetisasi mereka. Bukan download/reupload.</div>
      <div class="yt-input-row">
        <input type="text" id="yt-url" placeholder="Paste URL YouTube, live, shorts, atau playlist..." autocomplete="off">
        <button class="btn primary" id="yt-play">▶ Putar</button>
      </div>
      <div class="yt-chips">
        <span class="yt-chip" data-tpl="video">🎬 Video</span>
        <span class="yt-chip" data-tpl="live">🔴 Live</span>
        <span class="yt-chip" data-tpl="shorts">⚡ Shorts</span>
        <span class="yt-chip" data-tpl="playlist">📋 Playlist</span>
      </div>
      <div class="yt-player-shell">
        <div id="yt-empty" class="yt-empty">
          <div class="yt-empty-icon">📺</div>
          <div class="yt-empty-title">Belum ada video</div>
          <div class="yt-empty-sub">Paste URL di atas untuk mulai memutar</div>
        </div>
        <div id="yt-player-wrap" class="yt-player-wrap"></div>
      </div>
      <div class="yt-actions">
        <button class="btn" id="yt-pip" title="Picture-in-Picture">🖼 PiP</button>
        <button class="btn" id="yt-full" title="Fullscreen">⛶ Fullscreen</button>
        <button class="btn" id="yt-copy" title="Copy URL">📋 Copy URL</button>
        <button class="btn" id="yt-clear" title="Clear player">🗑 Clear</button>
      </div>
      <div class="yt-history-title">🕐 Riwayat Tonton</div>
      <div id="yt-history" class="yt-history"></div>
      <div class="yt-legend">
        <div class="yt-legend-title">📖 Panduan URL</div>
        <div class="yt-legend-items">
          <div><code>youtube.com/watch?v=XXX</code> → video biasa</div>
          <div><code>youtu.be/XXX</code> → shortlink</div>
          <div><code>youtube.com/live/XXX</code> → live streaming</div>
          <div><code>youtube.com/shorts/XXX</code> → shorts vertikal</div>
          <div><code>youtube.com/playlist?list=XXX</code> → playlist</div>
        </div>
      </div>
    `;
    const anchor=ct.querySelector("#tool-dl")||ct.querySelector("#tool-hands");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)
  }

  if(window.TOOL_TITLES)window.TOOL_TITLES.youtube="YouTube Player";

  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="youtube"]');
    if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-youtube");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="YouTube Player";
    localStorage.setItem("lastTool","youtube");
    $("sidebar")&&$("sidebar").classList.remove("open");
    $("overlay")&&$("overlay").classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind()}
  });

  if(typeof window.applyIcons==="function")window.applyIcons()
}

function bind(){
  const input=$("yt-url"),btn=$("yt-play");

  btn.addEventListener("click",()=>{
    const v=input.value.trim();
    if(!v)return toast("Paste URL YouTube dulu","error");
    play(v)
  });

  input.addEventListener("keydown",e=>{if(e.key==="Enter")btn.click()});

  // Chip template klik → fill contoh
  document.querySelectorAll(".yt-chip").forEach(c=>{
    c.addEventListener("click",()=>{
      const t=c.dataset.tpl;
      const sample={
        video:"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        live:"https://www.youtube.com/live/jfKfPfyJRdk",
        shorts:"https://www.youtube.com/shorts/dQw4w9WgXcQ",
        playlist:"https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
      }[t];
      input.value=sample;
      input.focus();
      toast("Contoh "+t+" — klik Putar","success")
    })
  });

  // PiP
  $("yt-pip").addEventListener("click",async()=>{
    const f=$("yt-iframe");
    if(!f)return toast("Putar video dulu","error");
    try{
      if(document.pictureInPictureElement){
        await document.exitPictureInPicture()
      }else if(f.requestPictureInPicture){
        await f.requestPictureInPicture()
      }else{
        toast("PiP tidak didukung browser ini","error")
      }
    }catch(e){toast("PiP error: "+e.message,"error")}
  });

  // Fullscreen
  $("yt-full").addEventListener("click",()=>{
    const f=$("yt-iframe");
    if(!f)return toast("Putar video dulu","error");
    const wrap=$("yt-player-wrap");
    try{
      if(document.fullscreenElement){document.exitFullscreen()}
      else if(wrap.requestFullscreen){wrap.requestFullscreen()}
      else toast("Fullscreen tidak didukung","error")
    }catch(e){toast("Fullscreen error: "+e.message,"error")}
  });

  // Copy URL
  $("yt-copy").addEventListener("click",()=>{
    const v=input.value.trim();
    if(!v)return toast("URL kosong","error");
    if(navigator.clipboard)navigator.clipboard.writeText(v).then(()=>toast("URL dicopy","success")).catch(()=>toast("Copy gagal","error"))
  });

  // Clear
  $("yt-clear").addEventListener("click",()=>{
    const wrap=$("yt-player-wrap"),empty=$("yt-empty");
    if(wrap){wrap.innerHTML="";wrap.style.display="none"}
    if(empty)empty.style.display="flex";
    input.value="";
    toast("Player di-clear","success")
  });

  // History
  const hist=$("yt-history");
  hist.addEventListener("click",e=>{
    const del=e.target.closest("[data-del]");
    if(del){
      e.stopPropagation();
      const list=loadHistory().filter(x=>x.id!==del.dataset.del);
      saveHistory(list);renderHistory();
      return
    }
    const item=e.target.closest(".yt-history-item");
    if(!item)return;
    play(item.dataset.id,item.querySelector(".yt-history-label").textContent)
  });

  renderHistory()
}

function boot(){
  if(!document.getElementById("tool-hash"))return;
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,500));else setTimeout(boot,500);
window.YouTubePlayer={extractID,play};
})();
