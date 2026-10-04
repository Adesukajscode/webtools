(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════
const CFG={
  targetFPS:30,
  bufferSec:12,         // window analisis
  minBPM:45,            // detak minimum valid
  maxBPM:180,           // detak maksimum valid
  warmupSec:3,          // tunggu stabil
  measureSec:10,        // durasi hitung
  peakThreshold:0.35,   // threshold peak detection
  refractorySec:0.35,   // jarak minimum antar peak (BPM max ~170)
  qualityMin:0.4        // threshold kualitas signal
};

// IIR Butterworth bandpass 0.8-3Hz @ 30fps
// Precomputed coefficients
const IIR_B=[0.1365, 0, -0.1365];
const IIR_A=[1, -1.7126, 0.7270];

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let stream=null, video=null, canvas=null, ctx=null, waveCanvas=null, waveCtx=null;
let running=!1, fps=0, lastFrame=0, frameCount=0, fpsTime=0;
let redBuf=[];         // rolling window raw red signal
let filtered=[];       // filtered signal
let timestamps=[];     // ms per sample
let bpmHistory=[];     // rolling BPM
let peaks=[];          // detected peaks (indices)
let currentBPM=0;
let quality=0;
let measureStart=0;
let state="idle";      // idle | warmup | measuring | done
let filterState=[0,0]; // IIR delay state
let bpmAvg=0;
let lastBeatTime=0;

// ═══════════════════════════════════════════════════════
// CAMERA
// ═══════════════════════════════════════════════════════
async function startCam(){
  const constraints=[
    {video:{facingMode:{exact:"environment"},width:{ideal:320},height:{ideal:240},frameRate:{ideal:30}},audio:!1},
    {video:{facingMode:"environment",width:{ideal:320},height:{ideal:240}},audio:!1},
    {video:!0,audio:!1}
  ];
  let lastErr;
  for(const c of constraints){
    try{
      stream=await navigator.mediaDevices.getUserMedia(c);
      // Coba nyalakan torch
      try{
        const track=stream.getVideoTracks()[0];
        const caps=track.getCapabilities?track.getCapabilities():{};
        if(caps.torch){
          await track.applyConstraints({advanced:[{torch:true}]});
          window.__torchOn=true;
        }else{
          window.__torchOn=false;
        }
      }catch(e){window.__torchOn=false;console.warn("[hrm] torch fail:",e.message)}
      return!0
    }catch(e){lastErr=e}
  }
  throw lastErr||Error("Kamera gagal")
}

function stopCam(){
  running=!1;
  if(stream){
    stream.getTracks().forEach(t=>{
      try{t.applyConstraints({advanced:[{torch:false}]})}catch(e){}
      t.stop()
    });
    stream=null
  }
  if(video)video.srcObject=null
}

// ═══════════════════════════════════════════════════════
// SIGNAL PROCESSING
// ═══════════════════════════════════════════════════════
// IIR filter 2nd order
function applyIIR(sample){
  const y=IIR_B[0]*sample + filterState[0];
  const ns0=IIR_B[1]*sample - IIR_A[1]*y;
  const ns1=IIR_B[2]*sample - IIR_A[2]*y;
  filterState[0]=ns0;
  filterState[1]=ns1;
  return y
}

// Get average red from center region
function sampleRed(){
  const w=video.videoWidth,h=video.videoHeight;
  if(!w||!h)return 0;
  // Sampling center 40% kotak
  const cx=Math.floor(w/2),cy=Math.floor(h/2);
  const rw=Math.floor(w*0.2),rh=Math.floor(h*0.2);
  const x0=cx-rw,y0=cy-rh;
  try{
    const data=ctx.getImageData(x0,y0,rw*2,rh*2).data;
    let r=0,g=0,b=0,n=0;
    for(let i=0;i<data.length;i+=16){ // skip pixel, sampling sparse
      r+=data[i];g+=data[i+1];b+=data[i+2];n++
    }
    if(!n)return 0;
    // Kombinasi: red - green (green juga berubah karena blood flow)
    return (r/n) - (g/n)*0.5
  }catch(e){return 0}
}

// Normalize array
function norm(arr){
  if(!arr.length)return arr;
  let mean=0;arr.forEach(v=>mean+=v);mean/=arr.length;
  let variance=0;arr.forEach(v=>variance+=(v-mean)**2);variance/=arr.length;
  const std=Math.sqrt(variance)||1;
  return arr.map(v=>(v-mean)/std)
}

// Peak detection
function detectPeaks(signal, sampleRate){
  const peaks=[];
  const refractory=Math.floor(CFG.refractorySec*sampleRate);
  let lastPeak=-refractory;
  for(let i=1;i<signal.length-1;i++){
    if(signal[i]>signal[i-1] && signal[i]>signal[i+1] && signal[i]>CFG.peakThreshold){
      if(i-lastPeak>=refractory){
        peaks.push(i);
        lastPeak=i
      }
    }
  }
  return peaks
}

// Hitung BPM dari interval peak
function calcBPM(peaks,sampleRate){
  if(peaks.length<2)return 0;
  const intervals=[];
  for(let i=1;i<peaks.length;i++){
    const dt=(peaks[i]-peaks[i-1])/sampleRate;
    if(dt>0){
      const bpm=60/dt;
      if(bpm>=CFG.minBPM&&bpm<=CFG.maxBPM)intervals.push(bpm)
    }
  }
  if(!intervals.length)return 0;
  // Median filter untuk buang outlier
  intervals.sort((a,b)=>a-b);
  const mid=Math.floor(intervals.length/2);
  const median=intervals.length%2?intervals[mid]:(intervals[mid-1]+intervals[mid])/2;
  // Average dari yang dekat median (±20%)
  const filtered=intervals.filter(x=>Math.abs(x-median)/median<0.2);
  const avg=filtered.reduce((a,b)=>a+b,0)/filtered.length;
  return Math.round(avg)
}

// Signal quality: 0-1
function calcQuality(peaks,sampleRate){
  if(peaks.length<3)return 0;
  const intervals=[];
  for(let i=1;i<peaks.length;i++)intervals.push((peaks[i]-peaks[i-1])/sampleRate);
  const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  const variance=intervals.reduce((s,x)=>s+(x-mean)**2,0)/intervals.length;
  const cv=Math.sqrt(variance)/mean; // coefficient of variation
  // CV rendah = kualitas tinggi
  return Math.max(0,Math.min(1,1-cv*2))
}

// ═══════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════
function loop(){
  if(!running)return;
  const now=performance.now();
  const elapsed=now-lastFrame;
  // Frame rate control (~30fps)
  if(elapsed<1000/CFG.targetFPS){
    requestAnimationFrame(loop);
    return
  }
  lastFrame=now;

  // FPS counter
  frameCount++;
  if(now-fpsTime>1000){
    fps=Math.round(frameCount*1000/(now-fpsTime));
    frameCount=0;fpsTime=now;
    const fpsEl=$("hrm-fps");if(fpsEl)fpsEl.textContent=fps+" FPS"
  }

  if(video.readyState<2){requestAnimationFrame(loop);return}

  // Grab frame
  const w=video.videoWidth,h=video.videoHeight;
  if(canvas.width!==w){canvas.width=w;canvas.height=h}
  ctx.drawImage(video,0,0,w,h);

  // Sample red
  const r=sampleRed();
  if(r<=0){requestAnimationFrame(loop);return}

  redBuf.push(r);
  timestamps.push(now);

  // Keep window
  const maxSamples=CFG.bufferSec*CFG.targetFPS;
  while(redBuf.length>maxSamples){redBuf.shift();timestamps.shift()}

  // Filter
  const detrended=r-(redBuf.reduce((a,b)=>a+b,0)/redBuf.length);
  const y=applyIIR(detrended);
  filtered.push(y);
  while(filtered.length>maxSamples)filtered.shift();

  // Peak detect (setiap 500ms)
  if(now-measureStart>500||!measureStart){
    if(filtered.length>CFG.targetFPS*2){
      const normS=norm(filtered);
      peaks=detectPeaks(normS,CFG.targetFPS);
      quality=calcQuality(peaks,CFG.targetFPS);
      const bpm=calcBPM(peaks,CFG.targetFPS);
      if(bpm>0&&quality>CFG.qualityMin){
        currentBPM=bpm;
        bpmHistory.push(bpm);
        while(bpmHistory.length>8)bpmHistory.shift();
        // Average dari 8 terakhir
        bpmAvg=Math.round(bpmHistory.reduce((a,b)=>a+b,0)/bpmHistory.length)
      }
    }
    measureStart=now
  }

  // Update UI
  updateUI();
  drawWave();

  requestAnimationFrame(loop)
}

// ═══════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════
function updateUI(){
  const bpmEl=$("hrm-bpm");
  const statusEl=$("hrm-status");
  const qualEl=$("hrm-quality-fill");
  const qLabel=$("hrm-quality-label");

  if(bpmEl)bpmEl.textContent=bpmAvg>0?bpmAvg:"--";

  if(qualEl){
    const pct=Math.round(quality*100);
    qualEl.style.width=pct+"%";
    qualEl.style.background=pct>70?"linear-gradient(90deg,#22c55e,#3b82f6)":pct>40?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#ef4444,#f472b6)"
  }
  if(qLabel){
    const pct=Math.round(quality*100);
    qLabel.textContent=pct+"%"
  }

  if(statusEl){
    let txt="Menunggu sinyal...",cls="";
    if(quality>=0.7&&bpmAvg>0){txt="✅ Sinyal bagus · Mengukur";cls="ok"}
    else if(quality>=0.4&&bpmAvg>0){txt="⚠️ Sinyal sedang · Cari posisi stabil";cls="warn"}
    else if(redBuf.length>0){txt="❌ Sinyal lemah · Tekan lebih rata di kamera";cls="err"}
    statusEl.textContent=txt;
    statusEl.className="hrm-status "+(cls?"hrm-"+cls:"")
  }
}

function drawWave(){
  if(!waveCanvas||!waveCtx)return;
  const w=waveCanvas.width,h=waveCanvas.height;
  waveCtx.clearRect(0,0,w,h);
  // Grid
  waveCtx.strokeStyle="rgba(59,130,246,0.08)";
  waveCtx.lineWidth=1;
  for(let y=0;y<h;y+=20){waveCtx.beginPath();waveCtx.moveTo(0,y);waveCtx.lineTo(w,y);waveCtx.stroke()}
  for(let x=0;x<w;x+=20){waveCtx.beginPath();waveCtx.moveTo(x,0);waveCtx.lineTo(x,h);waveCtx.stroke()}

  if(filtered.length<4)return;
  const data=norm(filtered);
  const N=data.length;
  const step=w/N;

  // Gradient
  const grad=waveCtx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,"#3b82f6");
  grad.addColorStop(0.5,"#06b6d4");
  grad.addColorStop(1,"#a78bfa");

  // Waveform
  waveCtx.beginPath();
  waveCtx.strokeStyle=grad;
  waveCtx.lineWidth=2.5;
  waveCtx.lineJoin="round";
  for(let i=0;i<N;i++){
    const x=i*step;
    const y=h/2 - data[i]*(h/2-10)*0.7;
    if(i===0)waveCtx.moveTo(x,y);
    else waveCtx.lineTo(x,y)
  }
  waveCtx.stroke();

  // Peaks overlay
  waveCtx.fillStyle="#ef4444";
  peaks.forEach(p=>{
    if(p>=N)return;
    const x=p*step;
    const y=h/2 - data[p]*(h/2-10)*0.7;
    waveCtx.beginPath();
    waveCtx.arc(x,y,4,0,Math.PI*2);
    waveCtx.fill();
    waveCtx.strokeStyle="rgba(239,68,68,0.4)";
    waveCtx.lineWidth=1;
    waveCtx.beginPath();
    waveCtx.moveTo(x,y);
    waveCtx.lineTo(x,h);
    waveCtx.stroke()
  })
}

// ═══════════════════════════════════════════════════════
// PREVIEW (jari di kamera)
// ═══════════════════════════════════════════════════════
function startPreview(){
  const prev=$("hrm-preview");
  if(!prev||!video)return;
  const pv=prev.getContext("2d");
  function tick(){
    if(!running)return;
    if(video.readyState>=2){
      prev.width=video.videoWidth||320;
      prev.height=video.videoHeight||240;
      pv.drawImage(video,0,0,prev.width,prev.height);
      // Center indicator
      const w=prev.width,h=prev.height;
      const cw=Math.floor(w*0.4),ch=Math.floor(h*0.4);
      pv.strokeStyle="rgba(59,130,246,0.8)";
      pv.lineWidth=3;
      pv.setLineDash([8,6]);
      pv.strokeRect((w-cw)/2,(h-ch)/2,cw,ch);
      pv.setLineDash([]);
      pv.fillStyle="rgba(59,130,246,0.9)";
      pv.font="bold 12px monospace";
      pv.textAlign="center";
      pv.fillText("Taruh jari di sini",w/2,h/2-4)
    }
    requestAnimationFrame(tick)
  }
  tick()
}

// ═══════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════
async function start(){
  const btn=$("hrm-start"),statusEl=$("hrm-status");
  btn.disabled=!0;btn.textContent="⏳ Memulai...";
  try{
    await startCam();
    video=$("hrm-video");
    video.srcObject=stream;
    video.setAttribute("playsinline","");
    video.muted=!0;
    await video.play();
    canvas=$("hrm-canvas");
    ctx=canvas.getContext("2d",{willReadFrequently:!0});
    waveCanvas=$("hrm-wave");
    waveCtx=waveCanvas.getContext("2d");
    waveCanvas.width=waveCanvas.clientWidth*2;
    waveCanvas.height=waveCanvas.clientHeight*2;
    waveCtx.scale(1,1);

    // reset
    redBuf=[];filtered=[];timestamps=[];peaks=[];bpmHistory=[];
    currentBPM=0;bpmAvg=0;quality=0;filterState=[0,0];
    lastFrame=0;fpsTime=performance.now();frameCount=0;

    running=!0;
    measureStart=0;
    loop();
    startPreview();

    btn.textContent="⏹ Stop";
    btn.disabled=!1;
    btn.classList.remove("primary");
    btn.classList.add("danger");
    if(statusEl){statusEl.textContent="🎯 Tempelkan jari ke kamera + flash";statusEl.className="hrm-status hrm-warn"}
    if(!window.__torchOn)toast("⚠️ Flash tidak tersedia — nyalakan manual","warn");
    else toast("💡 Flash aktif — tempelkan jari","success")
  }catch(e){
    console.error("[hrm] start fail:",e);
    btn.disabled=!1;btn.textContent="▶ Mulai Ukur";
    if(statusEl){statusEl.textContent="❌ "+e.message;statusEl.className="hrm-status hrm-err"}
    toast("Gagal: "+e.message,"error")
  }
}

function stop(){
  stopCam();
  const btn=$("hrm-start");
  btn.textContent="▶ Mulai Ukur";
  btn.classList.remove("danger");
  btn.classList.add("primary");
  const statusEl=$("hrm-status");
  if(statusEl){
    if(bpmAvg>0){
      statusEl.textContent="✅ Selesai · BPM rata-rata "+bpmAvg;
      statusEl.className="hrm-status hrm-ok"
    }else{
      statusEl.textContent="⏹ Berhenti · Tidak ada hasil";
      statusEl.className="hrm-status"
    }
  }
  // Clear canvas
  if(waveCtx&&waveCanvas)waveCtx.clearRect(0,0,waveCanvas.width,waveCanvas.height);
  if(ctx&&canvas)ctx.clearRect(0,0,canvas.width,canvas.height)
}

// ═══════════════════════════════════════════════════════
// BUILD UI
// ═══════════════════════════════════════════════════════
function build(){
  if($("tool-hrm"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="hrm"]')){
    const b=document.createElement("button");b.dataset.tool="hrm";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span> Heart Rate';
    const a=nav.querySelector('button[data-tool="face"]')||nav.querySelector('button[data-tool="hands"]')||nav.querySelector('button[data-tool="device"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-hrm")){
    const s=document.createElement("section");s.id="tool-hrm";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>🫀 Heart Rate Monitor</h2><p>Ukur detak jantung via kamera (rPPG) — jari di kamera + flash ON</p></div>
      <div class="hrm-warn">⚠️ <strong>Bukan alat medis.</strong> Untuk edukasi & tracking personal. Akurasi ~70-85%. Untuk diagnosis, konsultasi dokter.</div>
      <div class="hrm-layout">
        <div class="hrm-left">
          <div class="hrm-display">
            <div class="hrm-bpm-wrap">
              <div class="hrm-bpm" id="hrm-bpm">--</div>
              <div class="hrm-unit">BPM</div>
            </div>
            <div class="hrm-icon">🫀</div>
          </div>
          <div class="hrm-quality-wrap">
            <div class="hrm-quality-bar"><div class="hrm-quality-fill" id="hrm-quality-fill"></div></div>
            <div class="hrm-quality-info"><span>Signal Quality</span><span id="hrm-quality-label">0%</span></div>
          </div>
          <div class="hrm-status" id="hrm-status">Tekan tombol untuk mulai</div>
          <div class="hrm-controls">
            <button class="btn primary" id="hrm-start">▶ Mulai Ukur</button>
            <span class="hrm-fps" id="hrm-fps">0 FPS</span>
          </div>
        </div>
        <div class="hrm-right">
          <div class="hrm-preview-wrap">
            <canvas id="hrm-preview"></canvas>
            <video id="hrm-video" playsinline muted></video>
            <canvas id="hrm-canvas" style="display:none"></canvas>
          </div>
          <div class="hrm-wave-wrap">
            <canvas id="hrm-wave"></canvas>
          </div>
        </div>
      </div>
      <div class="hrm-tips">
        <div class="hrm-tips-title">📋 Cara Pakai</div>
        <ol>
          <li>Tekan <strong>Mulai Ukur</strong> → izinkan kamera</li>
          <li><strong>Tempelkan ujung jari telunjuk</strong> menutupi lensa kamera belakang</li>
          <li>Pastikan <strong>flash menyala</strong> (otomatis kalau device support)</li>
          <li>Jangan gerakkan jari — tekan rata selama <strong>10-15 detik</strong></li>
          <li>Tunggu angka BPM stabil</li>
        </ol>
        <div class="hrm-tips-note">💡 <strong>Tips:</strong> jari jangan terlalu kuat (pucat = no signal), jangan terlalu lemah (bocor cahaya). Cari tekanan yang pas sampai waveform muncul.</div>
      </div>`;
    const a=ct.querySelector("#tool-device")||ct.querySelector("#tool-face");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.hrm="Heart Rate";
  $("hrm-start").addEventListener("click",()=>{
    if(running)stop();
    else start()
  })
}

if(window.registerTool)window.registerTool("hrm",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));
else setTimeout(build,900);

window.HeartRate={
  start,stop,
  isRunning:()=>running,
  getBPM:()=>bpmAvg,
  getQuality:()=>quality
};
})();
