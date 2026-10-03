(function(){"use strict";
const $=id=>document.getElementById(id);
const toast=window.toast||(m=>console.log(m));
const VISION_CDN="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL_URL="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// 21 landmarks hand — koneksi skeleton
const CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const TIPS={thumb:4,index:8,middle:12,ring:16,pinky:20};
const PIPS={thumb:3,index:6,middle:10,ring:14,pinky:18};

let landmarker=null,stream=null,loop=null,running=!1,lastVideoTime=-1,fpsT=performance.now(),fpsC=0,fpsV=0;
let showSkeleton=!0,showPoints=!0,showLabel=!0,trailOn=!0;
const trails=new Map();

// ═══ LOAD MODEL ═══
async function loadModel(){
  if(landmarker)return!0;
  const vision=await import(VISION_CDN+"/vision_bundle.mjs");
  const fileset=await vision.FilesetResolver.forVisionTasks(WASM_URL);
  landmarker=await vision.HandLandmarker.createFromOptions(fileset,{
    baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"},
    runningMode:"VIDEO",
    numHands:2,
    minHandDetectionConfidence:.5,
    minHandPresenceConfidence:.5,
    minTrackingConfidence:.5
  });
  return!0
}

// ═══ CAMERA ═══
async function checkPerm(){
  try{
    if(!navigator.permissions||!navigator.permissions.query)return"unknown";
    const r=await navigator.permissions.query({name:"camera"});
    return r.state
  }catch(e){return"unknown"}
}

async function startCam(v){
  // coba bertingkat — dari constraint paling ideal ke paling longgar
  const attempts=[
    {video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:!1},
    {video:{facingMode:"user"},audio:!1},
    {video:!0,audio:!1},
  ];
  let lastErr;
  for(const c of attempts){
    try{
      stream=await navigator.mediaDevices.getUserMedia(c);
      v.srcObject=stream;
      await v.play();
      return!0
    }catch(e){lastErr=e}
  }
  throw lastErr||new Error("Kamera tidak bisa diakses")
}

function getPermHelp(errName){
  const help={
    "NotAllowedError":"Izin ditolak. Buka Settings browser → Site settings → Camera → Allow untuk webtools-vex.pages.dev, lalu refresh halaman.",
    "NotFoundError":"Tidak ada kamera terdeteksi di device ini.",
    "NotReadableError":"Kamera sedang dipakai aplikasi lain. Tutup app kamera/WhatsApp video call, coba lagi.",
    "OverconstrainedError":"Kamera tidak support resolusi yang diminta.",
    "SecurityError":"Halaman harus HTTPS. Buka via webtools-vex.pages.dev (bukan http).",
    "AbortError":"Kamera dihentikan. Coba lagi."
  };
  return help[errName]||"Error: "+errName
}
function stopCam(v){
  running=!1;
  if(loop){cancelAnimationFrame(loop);loop=null}
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  if(v)v.srcObject=null;
  trails.clear();
}

// ═══ GESTURE DETECTION ═══
function countFingers(lm,handedness){
  let count=0;
  const fingers=[];
  // 4 jari (index, middle, ring, pinky): tip y < pip y = extended (di koordinat normal, tapi di video mirror)
  ["index","middle","ring","pinky"].forEach(f=>{
    const tip=lm[TIPS[f]],pip=lm[PIPS[f]];
    const ext=tip.y<pip.y;
    if(ext)count++;
    fingers.push({name:f,ext});
  });
  // thumb: cek horizontal
  const thumbExt=Math.abs(lm[TIPS.thumb].x-lm[0].x)>Math.abs(lm[PIPS.thumb].x-lm[0].x);
  if(thumbExt)count++;
  fingers.unshift({name:"thumb",ext:thumbExt});
  return{count,fingers}
}

function detectGesture(lm,handed){
  const f=countFingers(lm,handed);
  const c=f.count;
  // Victory (V)
  if(!f.fingers[0].ext&&f.fingers[1].ext&&f.fingers[2].ext&&!f.fingers[3].ext&&!f.fingers[4].ext)return{name:"✌️ Peace",emoji:"✌️"};
  // OK sign: thumb tip & index tip dekat
  const dOk=Math.hypot(lm[4].x-lm[8].x,lm[4].y-lm[8].y);
  if(dOk<0.05&&f.fingers[2].ext&&f.fingers[3].ext&&f.fingers[4].ext)return{name:"👌 OK",emoji:"👌"};
  if(c===0)return{name:"✊ Fist",emoji:"✊"};
  if(c===5)return{name:"🖐 Open Palm",emoji:"🖐"};
  if(f.fingers[0].ext&&!f.fingers[1].ext&&!f.fingers[2].ext&&!f.fingers[3].ext&&!f.fingers[4].ext)return{name:"👍 Thumbs Up",emoji:"👍"};
  if(!f.fingers[0].ext&&f.fingers[1].ext&&!f.fingers[2].ext&&!f.fingers[3].ext&&!f.fingers[4].ext)return{name:"☝️ Pointing",emoji:"☝️"};
  if(!f.fingers[0].ext&&f.fingers[1].ext&&f.fingers[2].ext&&f.fingers[3].ext&&!f.fingers[4].ext)return{name:"🤟 Three",emoji:"🤟"};
  if(f.fingers[0].ext&&f.fingers[1].ext&&!f.fingers[2].ext&&!f.fingers[3].ext&&f.fingers[4].ext)return{name:"🤘 Rock",emoji:"🤘"};
  return{name:"Detecting...",emoji:"👋"}
}

// ═══ DRAW ═══
function draw(ctx,lm,w,h,color,handed,gesture){
  const toXY=p=>({x:(1-p.x)*w,y:p.y*h});
  // trails (index tip)
  if(trailOn){
    const tip=toXY(lm[8]);
    const key=handed;
    if(!trails.has(key))trails.set(key,[]);
    const arr=trails.get(key);
    arr.push({x:tip.x,y:tip.y,t:Date.now()});
    while(arr.length&&Date.now()-arr[0].t>1200)arr.shift();
    for(let i=0;i<arr.length-1;i++){
      const a=arr[i],b=arr[i+1];
      const alpha=(i/arr.length);
      ctx.beginPath();
      ctx.strokeStyle=`rgba(0,212,255,${alpha*0.7})`;
      ctx.lineWidth=alpha*8+1;
      ctx.lineCap="round";
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  }
  // skeleton
  if(showSkeleton){
    ctx.strokeStyle=color;
    ctx.lineWidth=3;
    ctx.lineCap="round";
    for(const[a,b]of CONNECTIONS){
      const pa=toXY(lm[a]),pb=toXY(lm[b]);
      ctx.beginPath();
      ctx.globalAlpha=0.85;
      ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  // points
  if(showPoints){
    lm.forEach((p,i)=>{
      const{x,y}=toXY(p);
      const isTip=Object.values(TIPS).includes(i);
      const r=isTip?7:4;
      // glow
      ctx.beginPath();
      ctx.fillStyle=color;
      ctx.globalAlpha=0.3;
      ctx.arc(x,y,r*2.5,0,Math.PI*2);ctx.fill();
      // core
      ctx.globalAlpha=1;
      ctx.beginPath();
      ctx.fillStyle=isTip?"#fff":color;
      ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      // outline
      ctx.strokeStyle=color;
      ctx.lineWidth=2;
      ctx.stroke();
    });
  }
  // label
  if(showLabel){
    const palm=toXY(lm[9]);
    const label=`${handed} · ${gesture.emoji} ${gesture.name}`;
    ctx.font="bold 15px system-ui,sans-serif";
    const tw=ctx.measureText(label).width+20;
    ctx.fillStyle="rgba(22,163,74,0.92)";
    ctx.beginPath();
    const bx=palm.x-tw/2,by=palm.y-30;
    ctx.roundRect?ctx.roundRect(bx,by,tw,26,8):ctx.rect(bx,by,tw,26);
    ctx.fill();
    ctx.fillStyle="#fff";
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(label,palm.x,palm.y-17);
    ctx.textAlign="start";ctx.textBaseline="alphabetic";
  }
}

// ═══ MAIN LOOP ═══
function loopFn(video,canvas,statusEl,statsEl){
  const ctx=canvas.getContext("2d");
  const w=video.videoWidth||640,h=video.videoHeight||480;
  canvas.width=w;canvas.height=h;
  function frame(){
    if(!running)return;
    if(video.readyState<2){loop=requestAnimationFrame(frame);return}
    if(video.currentTime!==lastVideoTime){
      lastVideoTime=video.currentTime;
      let res=null;
      try{res=landmarker.detectForVideo(video,performance.now())}catch(e){}
      ctx.clearRect(0,0,w,h);
      // background subtle
      ctx.drawImage(video,0,0,w,h);
      ctx.fillStyle="rgba(0,0,0,0.15)";
      ctx.fillRect(0,0,w,h);
      if(res&&res.landmarks&&res.landmarks.length){
        res.landmarks.forEach((lm,i)=>{
          const handed=res.handedness[i]?.[0]?.displayName||res.handednesses?.[i]?.[0]?.categoryName||"Hand";
          const g=detectGesture(lm,handed);
          const color=handed==="Left"?"#16a34a":"#0ea5e9";
          draw(ctx,lm,w,h,color,handed,g);
        });
        // stats
        fpsC++;
        const now=performance.now();
        if(now-fpsT>500){fpsV=Math.round(fpsC*1000/(now-fpsT));fpsC=0;fpsT=now}
        statsEl.innerHTML=`<span>🎯 <b>${res.landmarks.length}</b> tangan</span><span>⚡ <b>${fpsV}</b> FPS</span><span>📐 ${w}×${h}</span>`;
        const g=detectGesture(res.landmarks[0],res.handedness?.[0]?.[0]?.displayName||"Hand");
        statusEl.textContent=g.emoji+" "+g.name;
        statusEl.className="hd-status hd-status-ok";
      }else{
        statsEl.innerHTML=`<span>🎯 0 tangan</span><span>⚡ ${fpsV} FPS</span>`;
        statusEl.textContent="Tangan tidak terdeteksi";
        statusEl.className="hd-status";
      }
    }
    loop=requestAnimationFrame(frame)
  }
  running=!0;frame()
}

// ═══ BUILD UI ═══
function build(){
  if($("tool-hands"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="hands"]')){
    const b=document.createElement("button");b.dataset.tool="hands";
    b.innerHTML=`<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></span> Hand Tracking`;
    const anchor=nav.querySelector('button[data-tool="face"]')||nav.querySelector('button[data-tool="device"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b);
  }
  if(!$("tool-hands")){
    const s=document.createElement("section");s.id="tool-hands";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>Hand Tracking</h2><p>Deteksi 21 titik tangan real-time via webcam — MediaPipe AI</p></div>
      <div class="fc-privacy">🔒 <strong>Privacy:</strong> Video diproses 100% di browser kamu. Tidak ada frame yang dikirim ke server. Kamera bisa dimatikan kapan saja.</div>
      <div class="hd-stage">
        <video id="hd-video" playsinline muted style="display:none"></video>
        <canvas id="hd-canvas"></canvas>
        <div class="hd-status" id="hd-status">Kamera nonaktif</div>
        <div class="hd-fps" id="hd-fps"></div>
      </div>
      <div class="row">
        <button class="btn primary" id="hd-start">▶ Nyalakan Kamera</button>
        <button class="btn" id="hd-stop" disabled>⏹ Matikan</button>
      </div>
      <div class="hd-options">
        <label><input type="checkbox" id="hd-skel" checked> Skeleton</label>
        <label><input type="checkbox" id="hd-pts" checked> Landmark</label>
        <label><input type="checkbox" id="hd-lbl" checked> Label</label>
        <label><input type="checkbox" id="hd-trail" checked> Trail</label>
      </div>
      <div class="hd-legend">
        <div class="hd-legend-title">Gesture yang dikenali:</div>
        <div class="hd-legend-items">
          <span>✊ Fist</span><span>🖐 Open Palm</span><span>✌️ Peace</span><span>👍 Thumbs Up</span><span>👌 OK</span><span>☝️ Pointing</span><span>🤟 Three</span><span>🤘 Rock</span>
        </div>
      </div>
      <div class="hd-info">Tangan kiri = <span style="color:#16a34a;font-weight:700">hijau</span> · Tangan kanan = <span style="color:#0ea5e9;font-weight:700">biru</span> · Support 2 tangan sekaligus</div>
    `;
    const anchor=ct.querySelector("#tool-face")||ct.querySelector("#tool-device");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s);
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.hands="Hand Tracking";
  nav.addEventListener("click",e=>{
    const b=e.target.closest('button[data-tool="hands"]');
    if(!b)return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-hands");if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent="Hand Tracking";
    localStorage.setItem("lastTool","hands");
    $("sidebar")&&$("sidebar").classList.remove("open");
    $("overlay")&&$("overlay").classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind()}
  });
  if(typeof window.applyIcons==="function")window.applyIcons();
}

function bind(){
  const video=$("hd-video"),canvas=$("hd-canvas"),status=$("hd-status"),stats=$("hd-fps");
  const bStart=$("hd-start"),bStop=$("hd-stop");
  $("hd-skel").addEventListener("change",e=>showSkeleton=e.target.checked);
  $("hd-pts").addEventListener("change",e=>showPoints=e.target.checked);
  $("hd-lbl").addEventListener("change",e=>showLabel=e.target.checked);
  $("hd-trail").addEventListener("change",e=>trailOn=e.target.checked);

  bStart.addEventListener("click",async()=>{
    bStart.disabled=!0;bStart.textContent="⏳ Cek izin...";
    try{
      const perm=await checkPerm();
      if(perm==="denied"){
        bStart.disabled=!1;bStart.textContent="▶ Nyalakan Kamera";
        status.textContent="🚫 Izin kamera ditolak permanen. Reset di Settings browser.";
        status.className="hd-status hd-status-err";
        showPermGuide();
        toast("Izin ditolak. Lihat panduan reset.","error");
        return
      }
      bStart.textContent="⏳ Loading model...";
      await loadModel();
      bStart.textContent="⏳ Minta izin kamera...";
      const ok=await startCam(video);
      if(!ok)throw new Error("Kamera gagal");
      bStop.disabled=!1;bStart.textContent="▶ Kamera Aktif";
      status.textContent="Model siap · Deteksi aktif";
      status.className="hd-status hd-status-ok";
      loopFn(video,canvas,status,stats);
    }catch(e){
      bStart.disabled=!1;bStart.textContent="▶ Nyalakan Kamera";
      const help=getPermHelp(e.name);
      status.textContent=help;
      status.className="hd-status hd-status-err";
      if(e.name==="NotAllowedError")showPermGuide();
      toast(help,"error");
    }
  });

  function showPermGuide(){
    let box=$("hd-perm-guide");
    if(box){box.style.display="block";return}
    box=document.createElement("div");
    box.id="hd-perm-guide";
    box.className="hd-perm-guide";
    box.innerHTML=`
      <div class="hd-perm-title">🚫 Izin Kamera Ditolak — Cara Reset</div>
      <div class="hd-perm-body">
        <div class="hd-perm-step"><b>1.</b> Buka <b>Chrome → ⋮ → Settings → Site settings → Camera</b></div>
        <div class="hd-perm-step"><b>2.</b> Cari <code>webtools-vex.pages.dev</code> di daftar <b>"Blocked"</b></div>
        <div class="hd-perm-step"><b>3.</b> Tap situs → <b>Clear & reset</b> atau pindah ke <b>"Allowed"</b></div>
        <div class="hd-perm-step"><b>4.</b> Kembali ke sini → <b>Refresh halaman</b> (Ctrl+R / swipe down)</div>
        <div class="hd-perm-step"><b>5.</b> Klik <b>Nyalakan Kamera</b> → izin muncul lagi → tap <b>Allow</b></div>
        <div class="hd-perm-alt">
          <b>Alternatif cepat:</b><br>
          • Chrome: tap ikon 🔒 di address bar → <b>Permissions</b> → <b>Camera: Allow</b><br>
          • Atau buka di <b>Incognito</b> (izin fresh, langsung diminta ulang)<br>
          • Atau ganti browser (Firefox/Kiwi/Brave)
        </div>
      </div>
      <button class="btn" id="hd-perm-close">Mengerti</button>
    `;
    const anchor=document.querySelector("#tool-hands .row");
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(box,anchor.nextSibling);
    else if($("tool-hands"))$("tool-hands").appendChild(box);
    $("hd-perm-close").addEventListener("click",()=>box.style.display="none");
  }

  bStop.addEventListener("click",()=>{
    stopCam(video);
    bStart.disabled=!1;bStart.textContent="▶ Nyalakan Kamera";
    bStop.disabled=!0;
    status.textContent="Kamera nonaktif";
    status.className="hd-status";
    stats.innerHTML="";
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
  });
}

function boot(){
  if(!document.getElementById("tool-hash"))return;
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,450));else setTimeout(boot,450);
window.HandTracking={loadModel,isReady:()=>!!landmarker};
})();
