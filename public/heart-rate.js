(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
const C={fs:30,bufSec:8,warm:1.5,minB:42,maxB:200,rf:0.28,minQ:0.30,procMs:100,emaA:0.35,moThr:4.5};

let stream=null,vid=null,cv=null,ctx=null,wc=null,wx=null,on=!1,raf=null,procTO=null;
let fps=0,fc=0,fpsT=0,lastT=0,samples=[],startT=0,bpm=0,bpmF=0,bh=[],q=0,sat=0,filt=[],pk=[],torch=!1,motion=0,lastFr=null;

const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const std=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length||1))};
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};
const norm=a=>{const m=mean(a),s=std(a)||1;return a.map(v=>(v-m)/s)};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ═══ CAMERA ═══
async function camStart(){
  const A=[
    {video:{facingMode:{exact:"environment"},width:{ideal:320},height:{ideal:240},frameRate:{ideal:30,max:30}},audio:!1},
    {video:{facingMode:"environment",width:{ideal:320},height:{ideal:240}},audio:!1},
    {video:{facingMode:"environment"},audio:!1},{video:!0,audio:!1}];
  let e;
  for(const c of A){
    try{
      stream=await navigator.mediaDevices.getUserMedia(c);
      try{const t=stream.getVideoTracks()[0],cap=t.getCapabilities?t.getCapabilities():{};
        if(cap.torch){await t.applyConstraints({advanced:[{torch:!0}]});torch=!0}else torch=!1}catch(_){torch=!1}
      return
    }catch(x){e=x}
  }
  throw e||Error("Kamera gagal")
}

function camStop(){
  if(stream){stream.getTracks().forEach(t=>{try{t.applyConstraints({advanced:[{torch:!1}]})}catch(_){}try{t.stop()}catch(_){}});stream=null}
  if(vid)vid.srcObject=null
}

// ═══ SAMPLING ═══
function sampleRGB(){
  const w=vid.videoWidth,h=vid.videoHeight;if(!w||!h)return null;
  const rw=w*0.3|0,rh=h*0.3|0,x0=(w-rw)/2|0,y0=(h-rh)/2|0;
  try{
    const d=ctx.getImageData(x0,y0,rw,rh).data;
    let r=0,g=0,b=0,n=0,s=0;
    for(let i=0;i<d.length;i+=12){r+=d[i];g+=d[i+1];b+=d[i+2];if(d[i]>=248&&d[i+1]<=8&&d[i+2]<=8)s++;n++}
    if(!n)return null;
    return{r:r/n,g:g/n,b:b/n,sat:s/n}
  }catch(_){return null}
}

// ═══ DSP — Butterworth 2nd order bandpass [0.7, 3.5] Hz ═══
function butter(lo,hi,fs){
  const w1=Math.tan(Math.PI*lo/fs),n1=1+w1*Math.SQRT2+w1*w1;
  const w2=Math.tan(Math.PI*hi/fs),n2=1+w2*Math.SQRT2+w2*w2;
  return{
    hp:{b:[1/n1,-2/n1,1/n1],a:[1,2*(w1*w1-1)/n1,(1-w1*Math.SQRT2+w1*w1)/n1]},
    lp:{b:[w2*w2/n2,2*w2*w2/n2,w2*w2/n2],a:[1,2*(w2*w2-1)/n2,(1-w2*Math.SQRT2+w2*w2)/n2]}
  }
}

function iir(sig,c){
  const o=new Array(sig.length);let x1=0,x2=0,y1=0,y2=0;
  const{b,a}=c;
  for(let i=0;i<sig.length;i++){
    const y=b[0]*sig[i]+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2;
    o[i]=y;x2=x1;x1=sig[i];y2=y1;y1=y
  }
  return o
}

function detrend(a,w){
  const o=new Array(a.length);
  for(let i=0;i<a.length;i++){
    const lo=Math.max(0,i-w),hi=Math.min(a.length,i+w+1);
    let s=0;for(let j=lo;j<hi;j++)s+=a[j];
    o[i]=a[i]-s/(hi-lo)
  }
  return o
}

// ═══ MOTION ARTIFACT REJECTION ═══
function isMotion(s){
  if(!lastFr)return!1;
  const dx=Math.abs(s.r-lastFr.r)+Math.abs(s.g-lastFr.g)+Math.abs(s.b-lastFr.b);
  return dx>C.moThr
}

// ═══ PEAK ADAPTIVE ═══
function findPeaks(sig,fs){
  if(sig.length<6)return[];
  const m=mean(sig),sd=std(sig);
  const thr=m+C.emaA*sd; // adaptive threshold
  const rf=fs*C.rf|0;
  const p=[];let last=-rf;
  for(let i=1;i<sig.length-1;i++){
    if(sig[i]>sig[i-1]&&sig[i]>=sig[i+1]&&sig[i]>thr&&i-last>=rf){p.push(i);last=i}
  }
  return p
}

// ═══ BPM FROM PEAKS ═══
function bpmPeaks(p,fs){
  if(p.length<3)return null;
  const iv=[];
  for(let i=1;i<p.length;i++)iv.push((p[i]-p[i-1])/fs);
  const med=median(iv);
  const clean=iv.filter(x=>Math.abs(x-med)/med<0.22);
  if(clean.length<2)return null;
  const b=60/median(clean);
  if(b<C.minB||b>C.maxB)return null;
  return{bpm:Math.round(b),q:clamp(1-clean.length/iv.length*0.5,0,1)}
}

// ═══ FALLBACK: AUTOCORRELATION ═══
function bpmAC(s,fs){
  const n=s.length;if(n<60)return null;
  const mn=fs*60/C.maxB|0,mx=Math.min(fs*60/C.minB|0,n-3);
  if(mx<=mn)return null;
  let bl=0,bc=-Infinity;
  for(let l=mn;l<=mx;l++){
    let sm=0;for(let i=0;i<n-l;i++)sm+=s[i]*s[i+l];
    sm/=(n-l);
    if(sm>bc){bc=sm;bl=l}
  }
  if(bl<=0)return null;
  const b=60*fs/bl;
  if(b<C.minB||b>C.maxB)return null;
  return{bpm:Math.round(b),q:0.4}
}

// ═══ PROCESS ═══
function process(){
  if(samples.length<20)return null;
  const rA=[],gA=[],bA=[],rg=[],gb=[];
  for(const s of samples){rA.push(s.r);gA.push(s.g);bA.push(s.b);rg.push(s.r-s.g);gb.push(s.g-s.b)}
  const satA=mean(samples.map(s=>s.satRatio));
  const vRG=std(rg),vG=std(gA),vGB=std(gb);
  let raw = vRG>vG*1.15 ? rg : (vG>vGB*1.15 ? gA : gb);
  // Auto-gain kalau signal terlalu kecil
  const vRaw=std(raw);
  if(vRaw<0.5&&vRaw>0.001){const gain=1.5/vRaw;raw=raw.map(v=>v*gain)}
  const dt=detrend(raw,C.fs*0.7|0);
  const co=butter(0.7,3.5,C.fs);
  const f=iir(iir(dt,co.hp),co.lp);
  return{ns:norm(f),sat:satA}
}

// ═══ LOOP ═══
function loop(){
  if(!on)return;
  const now=performance.now();
  const ivMs=1000/C.fs;
  if(now-lastT<ivMs-3){raf=requestAnimationFrame(loop);return}
  lastT=now;
  fc++;
  if(now-fpsT>800){
    fps=Math.round(fc*1000/(now-fpsT));fc=0;fpsT=now;
    const el=$("hrm-fps");if(el)el.textContent=fps+" FPS"
  }
  if(vid.readyState<2){raf=requestAnimationFrame(loop);return}
  const w=vid.videoWidth,h=vid.videoHeight;
  if(cv.width!==w){cv.width=w;cv.height=h}
  ctx.drawImage(vid,0,0,w,h);
  const s=sampleRGB();
  if(!s){raf=requestAnimationFrame(loop);return}

  // Motion artifact check — skip kalau terlalu banyak gerak
  if(isMotion(s)){motion=Math.min(1,motion+0.05)}
  else{motion=Math.max(0,motion-0.02)}
  lastFr=s;

  // Motion terlalu tinggi → skip sample (tapi tetap update UI)
  if(motion<0.7){
    samples.push({r:s.r,g:s.g,b:s.b,satRatio:s.satRatio});
    const mx=C.bufSec*C.fs;while(samples.length>mx)samples.shift()
  }

  const el=now-startT,inW=el<C.warm*1000;
  if(!inW&&now-(window.__lp||0)>C.procMs){
    window.__lp=now;
    const p=process();
    if(p){
      filt=p.ns;sat=p.sat;
      const pks=findPeaks(p.ns,C.fs);pk=pks;
      let res=bpmPeaks(pks,C.fs)||bpmAC(p.ns,C.fs);
      let qq=0;
      if(pks.length>=3){
        const iv=[];
        for(let i=1;i<pks.length;i++)iv.push((pks[i]-pks[i-1])/C.fs);
        const m=mean(iv),s2=std(iv),cv=s2/(m||1);
        qq=clamp(1-cv*1.6,0,1);
        if(std(p.ns)>0.35)qq=clamp(qq+0.08,0,1)
      }
      // Motion penalty
      qq=clamp(qq*(1-motion*0.5),0,1);
      q=qq;
      if(res&&qq>=C.minQ){
        bh.push(res.bpm);while(bh.length>5)bh.shift();
        const m=median(bh);
        // EMA smoothing
        bpmF = bpmF===0 ? m : bpmF*(1-C.emaA)+m*C.emaA;
        bpm = Math.round(bpmF)
      }
    }
  }
  updateUI(el);drawWave();
  raf=requestAnimationFrame(loop)
}

// ═══ UI ═══
function updateUI(el){
  const b=$("hrm-bpm"),st=$("hrm-status"),qf=$("hrm-quality-fill"),ql=$("hrm-quality-label"),ic=document.querySelector(".hrm-icon");
  if(b){b.textContent=bpm>0?bpm:"--";if(ic){const per=bpm>0?60/bpm:1;ic.style.animationDuration=clamp(per,0.3,2)+"s"}}
  if(qf){const p=Math.round(q*100);qf.style.width=p+"%";
    qf.style.background=p>=70?"linear-gradient(90deg,#22c55e,#3b82f6)":p>=40?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#ef4444,#f472b6)"}
  if(ql)ql.textContent=Math.round(q*100)+"%";
  if(st){
    let t="",c="";
    if(el<C.warm*1000){t="⏱ Kalibrasi "+Math.ceil((C.warm*1000-el)/1000)+"s";c="warn"}
    else if(samples.length<20){t="⏳ Mengumpulkan data...";c="warn"}
    else if(motion>0.5){t="📳 Jangan gerakkan jari";c="err"}
    else if(q>=0.7&&bpm>0){t="✅ Sinyal bagus · "+bpm+" BPM";c="ok"}
    else if(q>=0.4&&bpm>0){t="⚠️ Sinyal sedang";c="warn"}
    else if(sat>0.5&&!torch){t="💡 Flash OFF";c="err"}
    else{t="❌ Sinyal lemah — tekan jari lebih rata";c="err"}
    st.textContent=t;st.className="hrm-status"+(c?" hrm-"+c:"")
  }
}

function drawWave(){
  if(!wc||!wx)return;
  const w=wc.width,h=wc.height;wx.clearRect(0,0,w,h);
  wx.strokeStyle="rgba(59,130,246,0.08)";wx.lineWidth=1;
  for(let y=0;y<h;y+=20){wx.beginPath();wx.moveTo(0,y);wx.lineTo(w,y);wx.stroke()}
  for(let x=0;x<w;x+=20){wx.beginPath();wx.moveTo(x,0);wx.lineTo(x,h);wx.stroke()}
  if(!filt.length)return;
  const N=filt.length,step=w/N;
  const g=wx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,"#3b82f6");g.addColorStop(.5,"#06b6d4");g.addColorStop(1,"#a78bfa");
  wx.beginPath();wx.strokeStyle=g;wx.lineWidth=2.4;wx.lineJoin="round";
  for(let i=0;i<N;i++){
    const x=i*step,y=h/2-filt[i]*(h/2-8)*0.65;
    if(i===0)wx.moveTo(x,y);else wx.lineTo(x,y)
  }
  wx.stroke();
  // Peaks
  wx.fillStyle="#ef4444";
  pk.forEach(p=>{if(p>=N)return;
    const x=p*step,y=h/2-filt[p]*(h/2-8)*0.65;
    wx.beginPath();wx.arc(x,y,3.5,0,Math.PI*2);wx.fill();
    wx.strokeStyle="rgba(239,68,68,0.35)";wx.lineWidth=1;
    wx.beginPath();wx.moveTo(x,y);wx.lineTo(x,h);wx.stroke()
  })
}

function startPreview(){
  const p=$("hrm-preview");if(!p||!vid)return;
  const pc=p.getContext("2d");
  function tick(){
    if(!on)return;
    if(vid.readyState>=2){
      p.width=vid.videoWidth||320;p.height=vid.videoHeight||240;
      pc.drawImage(vid,0,0,p.width,p.height);
      const w=p.width,h=p.height,cw=w*0.55|0,ch=h*0.55|0;
      // Motion warning border
      pc.strokeStyle=motion>0.5?"rgba(239,68,68,0.9)":"rgba(59,130,246,0.9)";
      pc.lineWidth=4;pc.setLineDash([10,6]);
      pc.strokeRect((w-cw)/2,(h-ch)/2,cw,ch);pc.setLineDash([]);
      pc.fillStyle="rgba(59,130,246,0.95)";pc.font="bold 13px monospace";pc.textAlign="center";
      pc.fillText(motion>0.5?"📳 Tahan jari":"Taruh jari di sini",w/2,h/2-4)
    }
    requestAnimationFrame(tick)
  }
  tick()
}

// ═══ START/STOP ═══
async function start(){
  const btn=$("hrm-start");if(!btn)return;
  btn.disabled=!0;btn.textContent="⏳ Memulai...";
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error("Browser tidak support kamera");
    await camStart();
    vid=$("hrm-video");vid.srcObject=stream;vid.setAttribute("playsinline","");vid.muted=!0;
    await vid.play();
    await new Promise(r=>{if(vid.readyState>=2)return r();vid.onloadedmetadata=()=>r();setTimeout(r,1500)});
    cv=$("hrm-canvas");ctx=cv.getContext("2d",{willReadFrequently:!0});
    wc=$("hrm-wave");
    if(wc){wx=wc.getContext("2d");wc.width=wc.clientWidth*2;wc.height=wc.clientHeight*2}
    samples=[];filt=[];pk=[];bh=[];bpm=0;bpmF=0;q=0;sat=0;fps=0;fc=0;motion=0;lastFr=null;
    fpsT=performance.now();lastT=0;startT=performance.now();window.__lp=0;
    on=!0;raf=requestAnimationFrame(loop);startPreview();
    btn.textContent="⏹ Stop";btn.classList.remove("primary");btn.classList.add("danger");
    btn.disabled=!1;
    T(torch?"💡 Flash aktif":"⚠️ Flash OFF",torch?"success":"warn")
  }catch(e){
    console.error("[hrm]",e);
    btn.disabled=!1;btn.textContent="▶ Mulai Ukur";
    const st=$("hrm-status");if(st){st.textContent="❌ "+e.message;st.className="hrm-status hrm-err"}
    T("Gagal: "+e.message,"error");try{camStop()}catch(_){}
  }
}

function stop(){
  on=!1;if(raf)cancelAnimationFrame(raf);
  camStop();
  const btn=$("hrm-start");
  if(btn){btn.textContent="▶ Mulai Ukur";btn.classList.remove("danger");btn.classList.add("primary")}
  const st=$("hrm-status");
  if(st){if(bpm>0){st.textContent="✅ Selesai · BPM: "+bpm;st.className="hrm-status hrm-ok"}
    else{st.textContent="⏹ Berhenti";st.className="hrm-status"}}
  if(wx&&wc)wx.clearRect(0,0,wc.width,wc.height);
  if(ctx&&cv)ctx.clearRect(0,0,cv.width,cv.height)
}

function build(){
  if($("tool-hrm"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="hrm"]')){
    const b=document.createElement("button");b.dataset.tool="hrm";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span> Heart Rate';
    const a=nav.querySelector('button[data-tool="face"]')||nav.querySelector('button[data-tool="hands"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-hrm")){
    const s=document.createElement("section");s.id="tool-hrm";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>🫀 Heart Rate Monitor</h2><p>Real-time rPPG · Adaptive · Motion-reject</p></div>
      <div class="hrm-warn">⚠️ <strong>Bukan alat medis.</strong> Edukasi & tracking. Akurasi ~75-88%.</div>
      <div class="hrm-layout">
        <div class="hrm-left">
          <div class="hrm-display">
            <div class="hrm-bpm-wrap"><div class="hrm-bpm" id="hrm-bpm">--</div><div class="hrm-unit">BPM</div></div>
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
          <div class="hrm-wave-wrap"><canvas id="hrm-wave"></canvas></div>
        </div>
      </div>
      <div class="hrm-tips">
        <div class="hrm-tips-title">📋 Cara Pakai</div>
        <ol>
          <li>Tekan <strong>Mulai Ukur</strong> → izinkan kamera</li>
          <li><strong>Tempelkan ujung jari</strong> ke kamera belakang</li>
          <li>Tunggu <strong>1.5 detik kalibrasi</strong></li>
          <li>Tahan <strong>5-10 detik</strong> — BPM muncul saat quality ≥ 30%</li>
        </ol>
        <div class="hrm-tips-note">💡 Jangan gerakkan jari. Kalau status merah, tekan jari lebih rata.</div>
      </div>`;
    const a=ct.querySelector("#tool-device")||ct.querySelector("#tool-face");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.hrm="Heart Rate";
  $("hrm-start").addEventListener("click",()=>{on?stop():start()})
}

if(window.registerTool)window.registerTool("hrm",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));
else setTimeout(build,900);
window.HeartRate={start,stop,isRunning:()=>on,getBPM:()=>bpm,getQuality:()=>q,motion:()=>motion};
})();
