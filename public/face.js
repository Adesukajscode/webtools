(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));
const FACE_KEY="ct_faces";
const CDN="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.js";
const MODELS="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";
const THRESHOLD=0.55; // lebih kecil = lebih ketat. 0.5-0.6 umum

let api=null,loaded=!1,stream=null,loopId=null,running=!1,detectorOpts={inputSize:320,scoreThreshold:.5};

// ═══ LOAD LIBRARY ═══
async function loadAPI(){
  if(loaded)return!0;
  if(!window.faceapi){
    await new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src=CDN;s.async=!0;
      s.onload=res;s.onerror=()=>rej(new Error("Gagal load face-api.js"));
      document.head.appendChild(s)
    })
  }
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODELS),
  ]);
  api=faceapi;loaded=!0;
  return!0
}

// ═══ STORAGE ═══
function loadFaces(){
  try{return JSON.parse(localStorage.getItem(FACE_KEY)||"[]")}
  catch(e){return[]}
}
function saveFaces(list){
  try{localStorage.setItem(FACE_KEY,JSON.stringify(list));return!0}
  catch(e){toast("Storage penuh","error");return!1}
}

// ═══ COSINE DISTANCE (untuk compare descriptor) ═══
function euclid(a,b){
  let s=0;
  for(let i=0;i<a.length;i++){const d=a[i]-b[i];s+=d*d}
  return Math.sqrt(s)
}

// ═══ CAMERA ═══
async function startCamera(video){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    toast("Browser tidak support kamera","error");
    return!1
  }
  const attempts=[
    {video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:!1},
    {video:{facingMode:"user"},audio:!1},
    {video:!0,audio:!1},
  ];
  let lastErr;
  for(const c of attempts){
    try{
      stream=await navigator.mediaDevices.getUserMedia(c);
      video.srcObject=stream;
      video.setAttribute("playsinline","true");
      video.muted=!0;
      await video.play().catch(()=>{});
      await new Promise(r=>{
        if(video.readyState>=2)return r();
        video.onloadedmetadata=()=>r();
        setTimeout(r,1500);
      });
      console.log("[face] camera OK");
      return!0
    }catch(e){lastErr=e;console.warn("[face] attempt failed:",e.name)}
  }
  const msg={
    "NotAllowedError":"Izin kamera ditolak. Buka Settings browser → izinkan kamera untuk domain ini.",
    "NotFoundError":"Tidak ada kamera di device ini.",
    "NotReadableError":"Kamera dipakai app lain. Tutup dulu, coba lagi.",
    "SecurityError":"Halaman harus HTTPS."
  }[lastErr?.name]||("Kamera gagal: "+(lastErr?.message||"unknown"));
  toast(msg,"error");
  return!1
}
function stopCamera(video){
  running=!1;
  if(loopId){cancelAnimationFrame(loopId);loopId=null}
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  if(video)video.srcObject=null
}

// ═══ DETECT LOOP ═══
async function detectLoop(video,canvas,cb){
  const ctx=canvas.getContext("2d");
  const run=async()=>{
    if(!running)return;
    if(video.readyState<2){loopId=requestAnimationFrame(run);return}
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    try{
      const res=await api
        .detectAllFaces(video,new api.TinyFaceDetectorOptions(detectorOpts))
        .withFaceLandmarks()
        .withFaceDescriptors();
      const now=Date.now();
      for(const r of res){
        const b=r.detection.box;
        // draw box
        ctx.strokeStyle="#16a34a";ctx.lineWidth=3;
        ctx.strokeRect(b.x,b.y,b.width,b.height);
        // draw label
        ctx.fillStyle="rgba(22,163,74,0.9)";
        const label=r.detection.score.toFixed(2);
        ctx.font="bold 14px monospace";
        ctx.fillRect(b.x,b.y-20,ctx.measureText(label).width+12,20);
        ctx.fillStyle="#fff";
        ctx.fillText(label,b.x+6,b.y-5);
        // match with saved
        const m=matchFace(r.descriptor);
        if(m){
          ctx.fillStyle="rgba(14,165,233,0.95)";
          const txt=m.name+" "+(m.dist*100).toFixed(0)+"%";
          ctx.font="bold 16px sans-serif";
          ctx.fillRect(b.x,b.y+b.height+4,ctx.measureText(txt).width+16,24);
          ctx.fillStyle="#fff";
          ctx.fillText(txt,b.x+8,b.y+b.height+22);
        }
      }
      if(cb)cb(res)
    }catch(e){console.warn("[face] detect error:",e)}
    loopId=requestAnimationFrame(run)
  };
  running=!0;run()
}

// ═══ MATCH ═══
function matchFace(descriptor){
  const list=loadFaces();
  let best=null;
  for(const f of list){
    if(!f.descriptor)continue;
    const d=euclid(new Float32Array(f.descriptor),descriptor);
    if(d<THRESHOLD&&(!best||d<best.dist))best={name:f.name,dist:d,id:f.id}
  }
  return best
}

// ═══ UI ═══
function renderList(){
  const el=$("face-list");
  if(!el)return;
  const list=loadFaces();
  if(!list.length){
    el.innerHTML='<div class="fc-empty">Belum ada wajah terdaftar. Klik "Daftar Wajah" untuk memulai.</div>';
    return
  }
  el.innerHTML=list.map(f=>`
    <div class="fc-item" data-id="${f.id}">
      <div class="fc-avatar">${esc((f.name||"?").charAt(0).toUpperCase())}</div>
      <div class="fc-info">
        <div class="fc-name">${esc(f.name)}</div>
        <div class="fc-date">Terdaftar ${new Date(f.ts).toLocaleDateString("id-ID")} · ${f.samples||1}x sample</div>
      </div>
      <button class="fc-del" data-del="${f.id}" title="Hapus">🗑</button>
    </div>
  `).join("")
}

function build(){
  if($("tool-face"))return;
  const nav=$("nav");
  const ct=document.querySelector(".content");
  if(!nav||!ct)return;

  // nav button
  if(!nav.querySelector('button[data-tool="face"]')){
    const b=document.createElement("button");b.dataset.tool="face";
    b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01M15 10h.01M12 14c-1 0-2-.5-2-1h4c0 .5-1 1-2 1z"/><circle cx="12" cy="12" r="10"/></svg></span> Face Recognition`;
    const anchor=nav.querySelector('button[data-tool="device"]')||nav.querySelector('button[data-tool="apk"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b);
  }

  // section
  if(!$("tool-face")){
    const s=document.createElement("section");s.id="tool-face";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>Face Recognition</h2><p>Deteksi & kenali wajah dengan memori lokal — 100% di browser, tidak diupload</p></div>
      <div class="fc-privacy">🔒 <strong>Privacy:</strong> Wajah & data diproses di HP kamu. Tidak ada yang dikirim ke server. Hapus kapan saja dari daftar.</div>
      <div class="fc-stage">
        <video id="fc-video" playsinline muted></video>
        <canvas id="fc-canvas"></canvas>
        <div class="fc-status" id="fc-status">Kamera nonaktif</div>
      </div>
      <div class="row">
        <button class="btn primary" id="fc-start">▶ Nyalakan Kamera</button>
        <button class="btn" id="fc-stop" disabled>⏹ Matikan</button>
        <button class="btn primary" id="fc-register" disabled>➕ Daftar Wajah</button>
        <button class="btn" id="fc-recognize" disabled>🔍 Test Kenali</button>
      </div>
      <div class="fc-stats" id="fc-stats"></div>
      <div class="fc-list-title">Wajah Terdaftar (<span id="fc-count">0</span>)</div>
      <div class="fc-list" id="face-list"></div>
    `;
    const anchor=ct.querySelector("#tool-device")||ct.querySelector("#tool-apk");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s);
  }

  if(window.TOOL_TITLES)window.TOOL_TITLES.face="Face Recognition";

  // click handler
  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="face"]');
    if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-face");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Face Recognition";
    localStorage.setItem("lastTool","face");
    $("sidebar")&&$("sidebar").classList.remove("open");
    $("overlay")&&$("overlay").classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind()}
  });

  if(typeof window.applyIcons==="function")window.applyIcons();
}

function bind(){
  const video=$("fc-video"),canvas=$("fc-canvas"),status=$("fc-status");
  const bStart=$("fc-start"),bStop=$("fc-stop"),bReg=$("fc-register"),bRec=$("fc-recognize");
  const stats=$("fc-stats");

  renderList();
  $("fc-count").textContent=loadFaces().length;

  $("face-list").addEventListener("click",e=>{
    const b=e.target.closest("[data-del]");
    if(!b)return;
    if(!confirm("Hapus wajah ini?"))return;
    const list=loadFaces().filter(f=>f.id!==b.dataset.del);
    saveFaces(list);renderList();
    $("fc-count").textContent=list.length;
    toast("Wajah dihapus","success");
  });

  bStart.addEventListener("click",async()=>{
    bStart.disabled=!0;bStart.textContent="⏳ Loading model...";
    try{
      await loadAPI();
      const ok=await startCamera(video);
      if(!ok){bStart.disabled=!1;bStart.textContent="▶ Nyalakan Kamera";return}
      status.textContent="Model siap · Kamera aktif";
      status.className="fc-status fc-status-ok";
      bStop.disabled=!1;bReg.disabled=!1;bRec.disabled=!1;
      bStart.textContent="▶ Kamera Aktif";
      detectLoop(video,canvas,res=>{
        stats.innerHTML=`<span>👤 ${res.length} wajah</span><span>📐 ${canvas.width}×${canvas.height}</span>`
      });
    }catch(e){
      bStart.disabled=!1;bStart.textContent="▶ Nyalakan Kamera";
      status.textContent="Gagal: "+e.message;
      status.className="fc-status fc-status-err";
    }
  });

  bStop.addEventListener("click",()=>{
    stopCamera(video);
    bStart.disabled=!1;bStart.textContent="▶ Nyalakan Kamera";
    bStop.disabled=!0;bReg.disabled=!0;bRec.disabled=!0;
    status.textContent="Kamera nonaktif";
    status.className="fc-status";
    stats.innerHTML="";
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
  });

  bReg.addEventListener("click",async()=>{
    if(!loaded)return toast("Model belum siap","error");
    const name=prompt("Nama untuk wajah ini:");
    if(!name||!name.trim())return;
    status.textContent="📸 Mendaftar wajah...";
    try{
      // capture 3 sample untuk akurasi
      const samples=[];
      for(let i=0;i<3;i++){
        status.textContent=`📸 Sample ${i+1}/3...`;
        const r=await api
          .detectSingleFace(video,new api.TinyFaceDetectorOptions(detectorOpts))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if(r)samples.push(Array.from(r.descriptor));
        await new Promise(r=>setTimeout(r,400));
      }
      if(!samples.length)return toast("Tidak ada wajah terdeteksi","error");
      // rata-rata descriptor
      const avg=new Array(128).fill(0);
      samples.forEach(s=>s.forEach((v,i)=>avg[i]+=v/samples.length));
      const list=loadFaces();
      list.push({
        id:"f_"+Date.now(),
        name:name.trim().slice(0,30),
        descriptor:avg,
        samples:samples.length,
        ts:Date.now()
      });
      saveFaces(list);renderList();
      $("fc-count").textContent=list.length;
      status.textContent=`✅ "${name}" terdaftar dengan ${samples.length} sample`;
      status.className="fc-status fc-status-ok";
      toast("Wajah terdaftar","success");
    }catch(e){
      status.textContent="Gagal daftar: "+e.message;
      status.className="fc-status fc-status-err";
    }
  });

  bRec.addEventListener("click",async()=>{
    if(!loaded)return toast("Model belum siap","error");
    const list=loadFaces();
    if(!list.length)return toast("Daftarkan wajah dulu","error");
    status.textContent="🔍 Mencari kecocokan...";
    try{
      const r=await api
        .detectSingleFace(video,new api.TinyFaceDetectorOptions(detectorOpts))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if(!r)return toast("Tidak ada wajah di kamera","error");
      const m=matchFace(r.descriptor);
      if(m){
        const conf=Math.round((1-m.dist)*100);
        status.textContent=`✅ Cocok: ${m.name} (${conf}% confidence, dist ${m.dist.toFixed(3)})`;
        status.className="fc-status fc-status-ok";
        toast("Cocok dengan "+m.name,"success");
      }else{
        status.textContent="❌ Tidak ada kecocokan di daftar";
        status.className="fc-status fc-status-err";
        toast("Tidak dikenali","error");
      }
    }catch(e){
      status.textContent="Error: "+e.message;
    }
  });
}

// ═══ PATCH AUTH — Face login (opsional) ═══
// Kalau auth.js load dan ada wajah terdaftar, expose API untuk login via face
window.CyberFace={
  loadAPI,
  match:matchFace,
  list:loadFaces,
  clear:()=>{localStorage.removeItem(FACE_KEY);renderList&&renderList()}
};

function boot(){
  if(!document.getElementById("tool-hash"))return; // hanya di app.html
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,400));else setTimeout(boot,400);
})();
