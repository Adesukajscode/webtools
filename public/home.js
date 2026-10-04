(function(){"use strict";
const $=id=>document.getElementById(id);
const toast=window.toast||(m=>console.log(m));
const VKEY="ct_home_videos";

// ═══════════════════════════════════════════════════════
// VIDEO SLOT MANAGEMENT
// ═══════════════════════════════════════════════════════
function loadVideos(){
  try{return JSON.parse(localStorage.getItem(VKEY)||"[]")}catch(e){return[]}
}
function saveVideos(list){
  try{localStorage.setItem(VKEY,JSON.stringify(list))}catch(e){toast("Storage penuh","error")}
}

// Parse YouTube / Instagram / TikTok / video URL → embed
function parseVideo(url){
  if(!url)return null;
  url=url.trim();
  // YouTube
  let m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if(m)return{type:"iframe",src:`https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1`};
  // Direct video file
  if(/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url))return{type:"video",src:url};
  // Embed code — extract src
  m=url.match(/<iframe[^>]+src=["']([^"']+)["']/);
  if(m)return{type:"iframe",src:m[1]};
  // Generic iframe URL
  if(/^https?:\/\//i.test(url))return{type:"iframe",src:url};
  return null
}

function build(){
  if($("tool-home"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;

  // Nav button — paling atas
  if(!nav.querySelector('button[data-tool="home"]')){
    const b=document.createElement("button");b.dataset.tool="home";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span> Beranda';
    if(nav.firstChild)nav.insertBefore(b,nav.firstChild);else nav.appendChild(b)
  }

  // Tool section
  if(!$("tool-home")){
    const s=document.createElement("section");s.id="tool-home";s.className="tool";
    s.innerHTML=`
      <div class="home-hero">
        <div class="home-hero-content">
          <div class="home-hero-badge">✦ Selamat Datang</div>
          <h1 class="glitch" data-text="CyberToolbox">CyberToolbox</h1>
          <p>Kumpulan 30+ tools developer, downloader, media, AI, dan game — semua gratis, semua di browser. Klik menu di sidebar untuk mulai.</p>
          <div class="home-hero-stats">
            <div class="home-hero-stat"><b>30+</b>Tools</div>
            <div class="home-hero-stat"><b>100%</b>Gratis</div>
            <div class="home-hero-stat"><b>0</b>Login Wajib</div>
            <div class="home-hero-stat"><b>24/7</b>Online</div>
          </div>
        </div>
      </div>

      <div class="home-creator">
        <div class="home-creator-avatar">AF</div>
        <div class="home-creator-info">
          <div class="role">Creator & Developer</div>
          <h2 class="glitch" data-text="Ade A.F">Ade A.F</h2>
          <p>Pelajar yang membangun CyberToolbox dari nol — dari UI, backend functions, sampai integrasi AI. Web ini dibuat untuk belajar sekaligus memberikan tools berguna buat siapa saja yang butuh utility cepat.</p>
          <div class="home-creator-links">
            <a href="https://github.com/Adesukajscode/webtools" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              GitHub
            </a>
            <a href="https://webtools-vex.pages.dev" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Website
            </a>
            <a href="mailto:adeanantafahmi@gmail.com">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
              Email
            </a>
          </div>
        </div>
      </div>

      <div class="home-stats-grid">
        <div class="home-stat-card"><div class="home-stat-icon">🎯</div><div class="home-stat-num">30+</div><div class="home-stat-lbl">Tools Aktif</div></div>
        <div class="home-stat-card"><div class="home-stat-icon">⚡</div><div class="home-stat-num">100+</div><div class="home-stat-lbl">Deploy</div></div>
        <div class="home-stat-card"><div class="home-stat-icon">🌐</div><div class="home-stat-num">∞</div><div class="home-stat-lbl">Bandwidth</div></div>
        <div class="home-stat-card"><div class="home-stat-icon">🆓</div><div class="home-stat-num">Rp 0</div><div class="home-stat-lbl">Biaya</div></div>
      </div>

      <div class="home-section-title glitch" data-text="🎬 Video Showcase">🎬 Video Showcase</div>
      <div class="home-section-sub">Kotak untuk menaruh video — <strong>klik slot kosong</strong> untuk isi, <strong>klik slot terisi</strong> untuk play.</div>
      <div class="home-video-grid" id="home-videos"></div>
    `;
    if(ct.firstChild)ct.insertBefore(s,ct.firstChild);else ct.appendChild(s)
  }

  if(window.TOOL_TITLES)window.TOOL_TITLES.home="Beranda";
  renderVideos();
}

function renderVideos(){
  const grid=$("home-videos");
  if(!grid)return;
  const list=loadVideos();
  const TOTAL=4;
  let html="";
  for(let i=0;i<TOTAL;i++){
    const v=list[i];
    if(v&&v.url){
      const p=parseVideo(v.url);
      if(p){
        html+=`<div class="home-video-slot home-video-filled" data-i="${i}">
          ${p.type==="video"?`<video src="${p.src}" controls playsinline></video>`:`<iframe src="${p.src}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>`}
        </div>`;
        continue
      }
    }
    html+=`<div class="home-video-slot" data-i="${i}">
      <div class="home-video-slot-icon">▶</div>
      <div class="home-video-slot-label">Slot Video ${i+1}</div>
      <div class="home-video-slot-hint">Klik untuk isi</div>
    </div>`
  }
  grid.innerHTML=html;
  grid.querySelectorAll(".home-video-slot").forEach(el=>{
    el.addEventListener("click",(e)=>{
      const i=+el.dataset.i;
      if(el.classList.contains("home-video-filled")){
        // existing video — kalau mau edit, tanya
        if(e.target.tagName==="IFRAME"||e.target.tagName==="VIDEO")return;
        editSlot(i);return
      }
      addSlot(i)
    })
  })
}

function addSlot(i){
  const url=prompt("Paste URL video (YouTube, MP4, atau iframe embed):\n\nContoh:\nhttps://youtu.be/xxxxx\nhttps://example.com/video.mp4");
  if(!url)return;
  const p=parseVideo(url);
  if(!p)return toast("URL tidak dikenali","error");
  const list=loadVideos();
  list[i]={url,ts:Date.now()};
  saveVideos(list);
  renderVideos();
  toast("✅ Video ditambahkan","success")
}

function editSlot(i){
  const list=loadVideos();
  const cur=list[i]?.url||"";
  const action=prompt(`Slot ${i+1}\n\nKetik:\n- "ganti" untuk ganti URL\n- "hapus" untuk hapus\n- "batal" untuk skip\n\nURL saat ini: ${cur.slice(0,60)}`,"");
  if(!action)return;
  const a=action.toLowerCase().trim();
  if(a==="hapus"||a==="delete"||a==="remove"){
    list[i]=null;
    saveVideos(list.filter(Boolean).length?list:[]);
    const arr=loadVideos();
    arr[i]=null;
    saveVideos(arr.filter((_,k)=>k!==i));
    renderVideos();toast("Dihapus","success");return
  }
  if(a==="ganti"||a==="edit"||a==="ubah"){
    const nu=prompt("URL baru:",cur);
    if(!nu)return;
    const p=parseVideo(nu);
    if(!p)return toast("URL tidak valid","error");
    list[i]={url:nu,ts:Date.now()};
    saveVideos(list);renderVideos();toast("✅ Diganti","success")
  }
}

function boot(){if(!document.getElementById("tool-hash"))return;build()}
if(window.registerTool)window.registerTool("home",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,900));else setTimeout(boot,900);
})();
