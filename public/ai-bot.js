(function(){"use strict";
const $=id=>document.getElementById(id),
esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
toast=window.toast||(m=>console.log(m));

const SVG=`<svg class="rb" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f7ec"/><stop offset="1" stop-color="#a7e8be"/></linearGradient><linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fdff"/><stop offset="1" stop-color="#c4dcf5"/></linearGradient><linearGradient id="b3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a2e"/><stop offset="1" stop-color="#1e3a5f"/></linearGradient><radialGradient id="b4"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></radialGradient></defs><g class="rb-float"><line x1="50" y1="14" x2="50" y2="22" stroke="#5a6e5a" stroke-width="1.5" stroke-linecap="round"/><circle class="rb-antenna" cx="50" cy="12" r="3.5" fill="#22c55e"/><circle class="rb-glow" cx="50" cy="12" r="6" fill="url(#b4)"/><rect x="26" y="22" width="48" height="38" rx="14" fill="url(#b2)" stroke="#8ab5d4" stroke-width="1.5"/><rect x="32" y="30" width="36" height="22" rx="10" fill="url(#b3)"/><g class="rb-eye" style="transform-origin:41px 41px"><circle cx="41" cy="41" r="4" fill="#22c55e"/><circle cx="41" cy="41" r="2" fill="#a7f3d0"/></g><g class="rb-eye" style="transform-origin:59px 41px"><circle cx="59" cy="41" r="4" fill="#22c55e"/><circle cx="59" cy="41" r="2" fill="#a7f3d0"/></g><rect class="rb-mouth" x="44" y="55" width="12" height="2" rx="1" fill="#8ab5d4" style="transform-origin:50px 56px"/><rect x="47" y="60" width="6" height="4" fill="#8ab5d4"/><rect x="30" y="64" width="40" height="26" rx="10" fill="url(#b1)" stroke="#8ab5d4" stroke-width="1.5"/><rect x="40" y="70" width="20" height="10" rx="4" fill="#1e3a5f"/><circle class="rb-glow" cx="45" cy="75" r="2" fill="#22c55e"/><circle cx="50" cy="75" r="2" fill="#0ea5e9"/><circle cx="55" cy="75" r="2" fill="#f59e0b"/><rect x="22" y="66" width="6" height="18" rx="3" fill="url(#b1)" stroke="#8ab5d4" stroke-width="1.5"/><rect x="72" y="66" width="6" height="18" rx="3" fill="url(#b1)" stroke="#8ab5d4" stroke-width="1.5"/><rect x="36" y="90" width="10" height="4" rx="2" fill="#8ab5d4"/><rect x="54" y="90" width="10" height="4" rx="2" fill="#8ab5d4"/></g></svg>`;

const FAQ=[
{kw:["apa","website","tentang","kamu","siapa"],a:"Hai! Aku **NEXA**, asisten AI **CyberToolbox** 🎯. Website ini punya **30+ tools** gratis, tanpa install — langsung dari browser."},
{kw:["download","tiktok","youtube","instagram","facebook","spotify","lagu","musik","video"],a:"**2 downloader** di sidebar:\n\n• **TikTok DL** — khusus TikTok\n• **Video Downloader** — YT/IG/FB/TikTok/Spotify/Twitter\n\nCara: Paste URL → Fetch → Download. 12 provider fallback. 🎬"},
{kw:["apk","playstore","android","install"],a:"**APK Downloader** ambil dari **APKPure**. Paste URL Play Store atau package name (contoh: `com.whatsapp`) → Fetch → APK + XAPK.\n\n⚠️ Bukan langsung dari Google."},
{kw:["hash","md5","sha","password"],a:"**Hash Generator** — MD5/SHA-1/256/512.\n**Password Generator** — password kuat + strength meter."},
{kw:["jwt","token","decode","auth"],a:"**JWT Decoder** — paste token → lihat header+payload+expiry."},
{kw:["qr","barcode"],a:"**QR Generator** — teks/URL → QR → download PNG."},
{kw:["game","arcade","slot","kasino","mainan"],a:"**Game Arcade** — 1000+ game HTML5 gratis.\n**Slot Kasino** — slot 3 reel (koin virtual). 🎮"},
{kw:["wikipedia","artikel","cari"],a:"**Wikipedia Tool** — cari artikel dari Wikipedia Indonesia + tombol 🎲 artikel acak."},
{kw:["jam","waktu","clock","jakarta","timezone"],a:"**Jam Jakarta** — jam analog real-time WIB + 8 timezone (Makassar, Tokyo, London, dll)."},
{kw:["ai","upscale","perbesar","hd","jernih"],a:"**AI Upscale HD** — perbesar foto 2x/3x/4x di browser (multi-pass bicubic + unsharp)."},
{kw:["color","grading","filter","warna"],a:"**Color Grading** — 12 preset sinematik + slider manual. Download JPG/PNG."},
{kw:["stabil","getar","shake"],a:"**Video Stabilizer** — analisis getaran, kasih stability score, preview frame."},
{kw:["face","wajah","recognition","kenali"],a:"**Face Recognition** — daftarkan wajah → auto-kenali via kamera. 100% client-side."},
{kw:["hand","tangan","track","gesture"],a:"**Hand Tracking** — 21 titik tangan real-time. Kenali ✊🖐✌️👍👌."},
{kw:["youtube","player","streaming","live"],a:"**YouTube Player** — putar video/live/shorts/playlist (legal via IFrame API)."},
{kw:["login","akun","masuk","google"],a:"**3 cara login:**\n\n1. Google Sign-In\n2. Token acak (ketik kode)\n3. Sidik jari (scan)\n\nSesi 1 tahun — login sekali, akses selamanya."},
{kw:["logout","keluar","reset"],a:"Tombol **Logout** di pojok kiri bawah untuk hapus sesi."},
{kw:["review","ulasan","feedback"],a:"Section **Ulasan Pengunjung** di bawah halaman app — isi nama+rating+pesan."},
{kw:["tool","fitur","daftar","list","semua"],a:"**30+ tools:**\n\n**Utility:** Hash, Base64, URL, Hex, JWT, UUID, Password, QR, JSON, Regex, Color, Cron, IP, Text, Time\n**Downloader:** TikTok, Video (6 platform), APK\n**Media:** AI Upscale, Color Grading, Video Stabilizer\n**AI/CV:** Face Recognition, Hand Tracking\n**Fun:** Game Arcade, Slot, YouTube Player, Wikipedia\n**Info:** Jam Jakarta, Device Info\n**Help:** Aku (NEXA)"},
{kw:["error","bug","gagal","gabisa"],a:"Kalau error:\n\n1. Cek Console browser (F12)\n2. Refresh halaman\n3. Kamera → cek izin\n4. Downloader → provider mungkin down, coba lagi"},
{kw:["kontak","developer","creator","owner"],a:"Dibuat oleh **Vex** + **Finixx**. Sumber: `Adesukajscode/webtools`."},
{kw:["gratis","harga","bayar","premium"],a:"**100% gratis.** Tanpa iklan, tanpa login wajib, tanpa premium."},
{kw:["halo","hai","hi","hello","hey"],a:"Halo! 👋 Aku **NEXA**, siap bantu. Tanya apa saja soal CyberToolbox."},
{kw:["makasih","thanks","thx","terima"],a:"Sama-sama! 😊"}
];

let cfg={mode:"cloud",ollamaUrl:"http://localhost:11434",model:"gemma2:2b"};
try{const s=JSON.parse(localStorage.getItem("ct_aibot")||"null");if(s)Object.assign(cfg,s)}catch(e){}
const save=()=>{try{localStorage.setItem("ct_aibot",JSON.stringify(cfg))}catch(e){}};
let messages=[],panel=null,fab=null,busy=!1;

const match=t=>{t=t.toLowerCase();let b=null,s=0;for(const f of FAQ){let sc=0;for(const k of f.kw)if(t.includes(k))sc+=k.length;if(sc>s){s=sc;b=f}}return s>0?b:null};

async function askCloud(msg){
  const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...messages.slice(-8),{role:"user",content:msg}]})});
  if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();
  if(!d.ok)throw Error(d.error||"cloud fail");
  return d.reply
}

async function askOllama(msg){
  const sys="Kamu NEXA, asisten AI CyberToolbox (webtools-vex.pages.dev). Website punya 30+ tools: downloader, media tools, AI/CV, game, utility. Jawab SINGKAT ramah dalam Bahasa Indonesia.";
  const r=await fetch(cfg.ollamaUrl.replace(/\/$/,"")+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:cfg.model,messages:[{role:"system",content:sys},...messages.slice(-6),{role:"user",content:msg}],stream:!1})});
  if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();return d.message?.content||"..."
}

const fmt=t=>{let h=esc(t);h=h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>").replace(/^• (.+)$/gm,"<li>$1</li>").replace(/(<li>.*<\/li>)/s,"<ul>$1</ul>").replace(/\n/g,"<br>");return h};
const scroll=()=>{const e=$("aibot-msgs");if(e)e.scrollTop=e.scrollHeight};
const addMsg=(role,c)=>{const e=$("aibot-msgs");if(!e)return null;const d=document.createElement("div");d.className="aibot-msg "+role;d.innerHTML=fmt(c);e.appendChild(d);scroll();return d};
const addTyping=()=>{const e=$("aibot-msgs");if(!e)return null;const d=document.createElement("div");d.className="aibot-typing";d.id="aibot-typing";d.innerHTML="<span></span><span></span><span></span>";e.appendChild(d);scroll();return d};

function setState(s){
  const av=document.querySelector(".aibot-avatar");if(!av)return;
  av.classList.remove("rb-listen","rb-think","rb-talk","rb-happy");
  if(s!=="idle")av.classList.add("rb-"+s);
  const st=document.querySelector(".aibot-status");
  if(st){const t={idle:"Online · siap bantu",listen:"Mendengarkan...",think:"Berpikir...",talk:"Menjawab...",happy:"Selesai!"}[s]||"Online";st.innerHTML='<span class="aibot-status-dot"></span>'+t}
}

async function typeOut(text,el){
  const w=text.split(/(\s+)/);let acc="";
  for(let i=0;i<w.length;i++){acc+=w[i];el.innerHTML=fmt(acc);scroll();if(i%3===0)await new Promise(r=>setTimeout(r,18))}
  el.innerHTML=fmt(text);scroll()
}

async function send(){
  if(busy)return;
  const inp=$("aibot-input"),txt=(inp?.value||"").trim();
  if(!txt)return;
  inp.value="";busy=!0;
  const btn=$("aibot-send");if(btn)btn.disabled=!0;
  messages.push({role:"user",content:txt});
  addMsg("user",txt);setState("think");
  addTyping();
  try{
    let ans="";
    if(cfg.mode==="cloud"){
      try{ans=await askCloud(txt)}
      catch(e){const f=match(txt);ans=(f?f.a:"Maaf, aku belum punya info soal itu.")+"\n\n_(Cloud AI tidak aktif. Cek environment vars. Fallback FAQ.)_"}
    }else if(cfg.mode==="ollama"){
      try{ans=await askOllama(txt)}
      catch(e){const f=match(txt);ans=(f?f.a:"Maaf, aku belum punya info soal itu.")+"\n\n_(Ollama tidak aktif, fallback FAQ.)_"}
    }else{
      await new Promise(r=>setTimeout(r,400+Math.random()*500));
      const f=match(txt);
      ans=f?f.a:"Hmm, aku belum ngerti. Coba tanya soal:\n\n• Downloader video/musik\n• Game arcade\n• AI tools (upscale, face, hand)\n• Login / akun\n• Daftar tools\n\nAtau ketik **\"apa saja tools-nya?\"**"
    }
    $("aibot-typing")?.remove();
    setState("talk");
    const el=addMsg("bot","");
    await typeOut(ans,el);
    messages.push({role:"assistant",content:ans});
    setState("happy");
    setTimeout(()=>setState("idle"),1200);
    renderSugg()
  }catch(e){$("aibot-typing")?.remove();addMsg("bot","❌ Error: "+e.message);setState("idle")}
  finally{busy=!1;if(btn)btn.disabled=!1;inp?.focus()}
}

function renderSugg(){
  const el=$("aibot-sugg");if(!el)return;
  el.innerHTML=["Apa saja tools-nya?","Cara download TikTok","Cara main game","Cara pakai AI Upscale","Cara login","Tips foto HD"].map(s=>`<button class="aibot-sugg-btn">${esc(s)}</button>`).join("");
  el.querySelectorAll(".aibot-sugg-btn").forEach(b=>b.addEventListener("click",()=>{const i=$("aibot-input");if(i){i.value=b.textContent;send()}}))
}

function build(){
  if(panel)return;
  fab=document.createElement("button");fab.className="aibot-fab";fab.id="aibot-fab";fab.title="Tanya NEXA";fab.innerHTML=SVG;document.body.appendChild(fab);
  panel=document.createElement("div");panel.className="aibot-panel";panel.id="aibot-panel";
  panel.innerHTML=`
    <div class="aibot-head">
      <div class="aibot-avatar" id="aibot-avatar">${SVG}</div>
      <div class="aibot-info"><h4>NEXA <span class="aibot-mode-tag" id="aibot-mode">FAQ</span></h4><div class="aibot-status"><span class="aibot-status-dot"></span>Online · siap bantu</div></div>
      <button class="aibot-close" id="aibot-close">✕</button>
    </div>
    <div class="aibot-msgs" id="aibot-msgs"></div>
    <div class="aibot-sugg" id="aibot-sugg"></div>
    <div class="aibot-input-row">
      <textarea class="aibot-input" id="aibot-input" placeholder="Tanya apa saja..." rows="1"></textarea>
      <button class="aibot-send" id="aibot-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>
    <div class="aibot-settings" id="aibot-settings">
      <label>Mode</label>
      <select id="aibot-cfg-mode"><option value="cloud">☁️ Cloud AI (recommended)</option><option value="faq">📚 FAQ (offline)</option><option value="ollama">🤖 Ollama (butuh server)</option></select>
      <label>Ollama URL</label>
      <input type="text" id="aibot-cfg-url" placeholder="http://localhost:11434">
      <label>Model</label>
      <select id="aibot-cfg-model"><option value="gemma2:2b">Gemma 2 2B</option><option value="llama3.2:1b">Llama 3.2 1B</option><option value="qwen2.5:3b">Qwen 2.5 3B</option><option value="llama3.2:3b">Llama 3.2 3B</option><option value="phi3:mini">Phi 3 Mini</option><option value="gemma2:9b">Gemma 2 9B</option></select>
      <div class="aibot-settings-actions"><button class="btn primary" id="aibot-cfg-save">💾 Simpan</button><button class="btn" id="aibot-cfg-test">🔌 Test</button></div>
    </div>`;
  document.body.appendChild(panel);
  $("aibot-cfg-mode").value=cfg.mode;
  $("aibot-cfg-url").value=cfg.ollamaUrl;
  $("aibot-cfg-model").value=cfg.model;
  const mt=$("aibot-mode");mt.textContent=cfg.mode.toUpperCase();mt.className="aibot-mode-tag"+(cfg.mode==="ollama"?" ollama":"");
  $("aibot-close").addEventListener("click",close);
  $("aibot-send").addEventListener("click",send);
  const inp=$("aibot-input");
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
  inp.addEventListener("input",()=>{inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,100)+"px"});
  const av=$("aibot-avatar");let pt=null;
  const openS=()=>pt=setTimeout(()=>$("aibot-settings").classList.toggle("aibot-show"),600);
  const closeS=()=>clearTimeout(pt);
  av.addEventListener("mousedown",openS);av.addEventListener("mouseup",closeS);av.addEventListener("mouseleave",closeS);
  av.addEventListener("touchstart",openS);av.addEventListener("touchend",closeS);
  $("aibot-cfg-save").addEventListener("click",()=>{
    cfg.mode=$("aibot-cfg-mode").value;cfg.ollamaUrl=$("aibot-cfg-url").value.trim()||"http://localhost:11434";cfg.model=$("aibot-cfg-model").value;save();
    const mt=$("aibot-mode");mt.textContent=cfg.mode.toUpperCase();mt.className="aibot-mode-tag"+(cfg.mode==="ollama"?" ollama":"");
    $("aibot-settings").classList.remove("aibot-show");toast("✅ Disimpan","success")
  });
  $("aibot-cfg-test").addEventListener("click",async()=>{
    try{const r=await fetch($("aibot-cfg-url").value.trim().replace(/\/$/,"")+"/api/tags");const d=await r.json();toast("✅ Ollama aktif · "+(d.models||[]).length+" model","success")}
    catch(e){toast("❌ Gagal: "+e.message,"error")}
  });
  addMsg("bot","Halo! Aku **NEXA** 🤖 — asisten AI CyberToolbox.\n\nTanya apa saja tentang website ini, atau klik salah satu saran di bawah. 👇");
  renderSugg()
}

function open(){if(!panel)build();panel.classList.add("aibot-show");fab.classList.add("aibot-hide");setTimeout(()=>$("aibot-input")?.focus(),200)}
function close(){panel?.classList.remove("aibot-show");fab?.classList.remove("aibot-hide")}
function toggle(){panel?.classList.contains("aibot-show")?close():open()}

function boot(){build();fab.addEventListener("click",toggle)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,1200));else setTimeout(boot,1200);
window.NEXA={open,close,toggle,send,cfg};
})();
