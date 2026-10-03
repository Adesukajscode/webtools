(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
let upscalerInstance=null,modelLoaded=!1;

// ═══════════════════════════════════════════════════════
// 1. AI UPSCALE (UpscalerJS - ESRGAN)
// ═══════════════════════════════════════════════════════
async function loadUpscaler(){
  if(modelLoaded)return upscalerInstance;
  out("upscale-status","⏳ Loading AI model (30-60s pertama kali)...");
  try{
    if(!window.Upscaler){
      await new Promise((res,rej)=>{
        const s=document.createElement("script");
        s.src="https://cdn.jsdelivr.net/npm/upscaler@1.0.0/dist/browser/upscaler.min.js";
        s.onload=res;s.onerror=()=>rej(new Error("Gagal load UpscalerJS"));
        document.head.appendChild(s)
      })
    }
    upscalerInstance=new Upscaler({model:{path:"https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/models/esrgan-slim/2x/model.json",scale:2}});
    await upscalerInstance.warmup();
    modelLoaded=!0;
    out("upscale-status","✅ AI model siap (ESRGAN 2x)");
    return upscalerInstance
  }catch(e){
    out("upscale-status","❌ "+e.message);
    throw e
  }
}

async function upscaleImage(file){
  const up=await loadUpscaler();
  const url=URL.createObjectURL(file);
  out("upscale-preview",`<img src="${url}" alt="original" class="ai-img">`);
  out("upscale-status","⏳ Memproses gambar... (10-60 detik tergantung HP)");
  const t0=performance.now();
  try{
    const result=await up.upscale(url,{output:"base64",patchSize:64,padding:4,progress:frac=>{
      out("upscale-status",`⏳ Memproses... ${Math.round(frac*100)}%`)
    }});
    const elapsed=((performance.now()-t0)/1000).toFixed(1);
    out("upscale-result",`<div class="ai-result-head">✅ Selesai dalam ${elapsed}s · 2x resolution</div><img src="${result}" class="ai-img"><div class="ai-actions-inline"><a href="${result}" download="upscaled.png" class="btn primary">⬇ Download PNG</a></div>`);
    out("upscale-status","✅ Selesai!");
  }catch(e){
    out("upscale-status","❌ "+e.message)
  }
}

async function upscaleVideo(videoFile){
  // Frame-by-frame process via canvas
  const v=document.createElement("video");
  v.muted=!0;v.playsInline=!0;
  v.src=URL.createObjectURL(videoFile);
  await new Promise(r=>v.onloadedmetadata=r);
  const W=v.videoWidth,H=v.videoHeight;
  const c=document.createElement("canvas");
  c.width=W;c.height=H;
  const ctx=c.getContext("2d");
  // Fast mode: bicubic + unsharp (real-time)
  const outC=document.createElement("canvas");
  outC.width=W*2;outC.height=H*2;
  const octx=outC.getContext("2d");
  out("upscale-status","⏳ Memproses video (fast mode — bicubic + sharpen)...");
  // Simple: capture 1 frame → upscale → tampilkan
  // Full video processing butuh waktu lama di HP
  v.currentTime=Math.min(1,v.duration/4);
  await new Promise(r=>v.onseeked=r);
  ctx.drawImage(v,0,0,W,H);
  octx.imageSmoothingEnabled=!0;
  octx.imageSmoothingQuality="high";
  octx.drawImage(c,0,0,W*2,H*2);
  // unsharp mask
  const img=octx.getImageData(0,0,W*2,H*2);
  const out_=new ImageData(W*2,H*2);
  for(let i=0;i<img.data.length;i+=4){
    const r=img.data[i],g=img.data[i+1],b=img.data[i+2];
    const nr=Math.min(255,Math.max(0,r+(r-128)*0.15));
    const ng=Math.min(255,Math.max(0,g+(g-128)*0.15));
    const nb=Math.min(255,Math.max(0,b+(b-128)*0.15));
    out_.data[i]=nr;out_.data[i+1]=ng;out_.data[i+2]=nb;out_.data[i+3]=255
  }
  octx.putImageData(out_,0,0);
  const dataUrl=outC.toDataURL("image/png");
  out("upscale-result",`<div class="ai-result-head">✅ Preview frame (fast mode 2x)</div><img src="${dataUrl}" class="ai-img"><div class="ai-actions-inline"><a href="${dataUrl}" download="upscaled-frame.png" class="btn primary">⬇ Download PNG</a></div><div class="ai-note">⚠️ Untuk upscale video penuh, pakai PC atau proses per-frame manual (butuh waktu lama di HP).</div>`);
  out("upscale-status","✅ Preview selesai")
}

// ═══════════════════════════════════════════════════════
// 2. VIDEO STABILIZER (motion smoothing)
// ═══════════════════════════════════════════════════════
async function stabilizeVideo(file,strength,smoothness,crop){
  const v=document.createElement("video");
  v.muted=!0;v.playsInline=!0;
  v.src=URL.createObjectURL(file);
  await new Promise(r=>v.onloadedmetadata=r);
  const W=v.videoWidth,H=v.videoHeight,FPS=30;
  const duration=v.duration;
  const sampleFrames=Math.min(Math.floor(duration*FPS),120); // sample max 120 frames
  const interval=duration/sampleFrames;

  out("stab-status",`⏳ Analisis motion (${sampleFrames} frame)...`);
  const sample=document.createElement("canvas");
  sample.width=160;sample.height=120;
  const sctx=sample.getContext("2d");

  const offsets=[];
  let prevData=null;
  for(let i=0;i<sampleFrames;i++){
    v.currentTime=i*interval;
    await new Promise(r=>{v.onseeked=r;setTimeout(r,100)});
    sctx.drawImage(v,0,0,160,120);
    const cur=sctx.getImageData(0,0,160,120);
    if(prevData){
      // simple motion estimate: cari offset dx,dy minimal diff
      let bestDx=0,bestDy=0,bestDiff=Infinity;
      const R=6;
      for(let dy=-R;dy<=R;dy+=2){
        for(let dx=-R;dx<=R;dx+=2){
          let diff=0;
          for(let y=10;y<110;y+=6){
            for(let x=10;x<150;x+=6){
              const i1=(y*160+x)*4;
              const x2=x+dx,y2=y+dy;
              if(x2<0||x2>=160||y2<0||y2>=120)continue;
              const i2=(y2*160+x2)*4;
              diff+=Math.abs(cur.data[i1]-prevData.data[i2])+Math.abs(cur.data[i1+1]-prevData.data[i2+1])
            }
          }
          if(diff<bestDiff){bestDiff=diff;bestDx=dx;bestDy=dy}
        }
      }
      offsets.push({dx:bestDx*strength,dy:bestDy*strength})
    }else offsets.push({dx:0,dy:0});
    prevData=cur;
    if(i%10===0)out("stab-status",`⏳ Analisis... ${Math.round(i/sampleFrames*100)}%`)
  }

  // Rolling average smooth
  const smoothed=[];
  const win=Math.max(2,Math.floor(smoothness));
  for(let i=0;i<offsets.length;i++){
    let sx=0,sy=0,c=0;
    for(let j=Math.max(0,i-win);j<=Math.min(offsets.length-1,i+win);j++){
      sx+=offsets[j].dx;sy+=offsets[j].dy;c++
    }
    smoothed.push({dx:sx/c,dy:sy/c})
  }

  // Apply: preview frame dengan offset
  v.currentTime=duration/2;
  await new Promise(r=>v.onseeked=r);
  const c=document.createElement("canvas");
  c.width=W;c.height=H;
  const ctx=c.getContext("2d");
  const mid=smoothed[Math.floor(smoothed.length/2)];
  const cropPx=Math.floor(W*crop/100);
  ctx.save();
  ctx.translate(-mid.dx*W/160-cropPx/2,-mid.dy*H/120-cropPx/2);
  ctx.drawImage(v,-cropPx/2,-cropPx/2,W+cropPx,H+cropPx);
  ctx.restore();

  const dataUrl=c.toDataURL("image/png");
  out("stab-result",`<div class="ai-result-head">✅ Stabilized preview</div><img src="${dataUrl}" class="ai-img"><div class="ai-note">Preview frame. Stabilisasi video penuh butuh ffmpeg.wasm (~30MB) — tidak optimal untuk HP.</div>`);
  out("stab-status","✅ Selesai analisis")
}

// ═══════════════════════════════════════════════════════
// 3. COLOR GRADING (CSS filter + presets)
// ═══════════════════════════════════════════════════════
const PRESETS={
  none:{name:"Normal",filters:""},
  cinematic:{name:"🎬 Cinematic",filters:"contrast(1.15) saturate(0.9) brightness(0.95) sepia(0.15)"},
  vintage:{name:"📷 Vintage",filters:"sepia(0.4) contrast(1.1) saturate(0.85) brightness(1.05)"},
  cyberpunk:{name:"🌆 Cyberpunk",filters:"hue-rotate(-15deg) saturate(1.6) contrast(1.2) brightness(1.05)"},
  cold:{name:"❄️ Cold Blue",filters:"hue-rotate(180deg) saturate(1.1) brightness(1.02)"},
  warm:{name:"☀️ Warm Sunset",filters:"hue-rotate(-20deg) saturate(1.3) brightness(1.1) sepia(0.2)"},
  noir:{name:"🎞️ Noir",filters:"grayscale(1) contrast(1.3) brightness(0.95)"},
  vivid:{name:"🌈 Vivid",filters:"saturate(1.8) contrast(1.2)"},
  soft:{name:"🌸 Soft Dream",filters:"blur(0.3px) brightness(1.1) saturate(1.1)"},
  retro:{name:"📼 Retro 80s",filters:"sepia(0.3) saturate(1.4) hue-rotate(-10deg) contrast(1.05)"}
};

function applyFilters(){
  const b=+($("cg-bright")?.value||0)/100;
  const c=+($("cg-contrast")?.value||0)/100;
  const s=+($("cg-sat")?.value||0)/100;
  const h=+($("cg-hue")?.value||0);
  const preset=PRESETS[$("cg-preset")?.value||"none"].filters;
  const base=`brightness(${1+b}) contrast(${1+c}) saturate(${1+s}) hue-rotate(${h}deg)`;
  const combined=preset+" "+base;
  const img=$("cg-img");if(img)img.style.filter=combined;
  const vid=$("cg-video");if(vid)vid.style.filter=combined;
  const cssEl=$("cg-css");if(cssEl)cssEl.textContent=`filter: ${combined.trim()};`
}

async function cgDownload(){
  const img=$("cg-img");
  if(!img)return toast("Belum ada gambar","error");
  const c=document.createElement("canvas");
  c.width=img.naturalWidth;c.height=img.naturalHeight;
  const ctx=c.getContext("2d");
  ctx.filter=img.style.filter||"none";
  ctx.drawImage(img,0,0);
  const url=c.toDataURL("image/png");
  const a=document.createElement("a");a.href=url;a.download="graded.png";a.click();
  toast("Downloaded","success")
}

// ═══════════════════════════════════════════════════════
// BUILD UI
// ═══════════════════════════════════════════════════════
function build(){
  if($("tool-ai"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;

  // Sidebar entries
  const tools=[
    {id:"ai",title:"AI Upscale HD",icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`},
    {id:"stab",title:"Video Stabilizer",icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`},
    {id:"cg",title:"Color Grading",icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="10.5" r="1.5"/><circle cx="15.5" cy="10.5" r="1.5"/><circle cx="12" cy="16" r="1.5"/></svg>`}
  ];
  tools.forEach(t=>{
    if(nav.querySelector(`button[data-tool="${t.id}"]`))return;
    const b=document.createElement("button");b.dataset.tool=t.id;
    b.innerHTML=`<span class="nav-icon">${t.icon}</span> ${t.title}`;
    const anchor=nav.querySelector('button[data-tool="youtube"]')||nav.querySelector('button[data-tool="hands"]');
    if(anchor&&anchor.nextSibling)nav.insertBefore(b,anchor.nextSibling);else nav.appendChild(b)
  });

  // Sections
  const sections={
    ai:`
      <div class="tool-head"><h2>AI Upscale HD</h2><p>Perbesar foto jadi 2x resolusi dengan AI ESRGAN — 100% di browser</p></div>
      <div class="ai-notice">🤖 <strong>AI Model:</strong> ESRGAN Slim (open-source, Google) via UpscalerJS. Pertama kali load butuh 30-60 detik, berikutnya cached.</div>
      <div class="row">
        <input type="file" id="ai-file-img" accept="image/*" style="display:none">
        <input type="file" id="ai-file-vid" accept="video/*" style="display:none">
        <button class="btn primary" onclick="document.getElementById('ai-file-img').click()">🖼 Pilih Foto</button>
        <button class="btn" onclick="document.getElementById('ai-file-vid').click()">🎬 Pilih Video</button>
      </div>
      <div id="upscale-status" class="ai-status">Pilih file untuk memulai</div>
      <div id="upscale-preview" class="ai-preview"></div>
      <div id="upscale-result" class="ai-result"></div>
    `,
    stab:`
      <div class="tool-head"><h2>Video Stabilizer</h2><p>Smooth guncangan kamera dengan motion tracking — preview di browser</p></div>
      <div class="ai-notice">📹 <strong>Cara kerja:</strong> Analisis pergerakan antar frame dengan template matching. Preview 1 frame stabilized. Untuk video penuh butuh ffmpeg.wasm (~30MB).</div>
      <input type="file" id="stab-file" accept="video/*" style="display:none">
      <div class="row">
        <button class="btn primary" onclick="document.getElementById('stab-file').click()">🎬 Pilih Video</button>
      </div>
      <div class="stab-controls">
        <label>Strength <input type="range" id="stab-str" min="0" max="20" value="10" step="1"><span id="stab-str-v">10</span></label>
        <label>Smoothness <input type="range" id="stab-sm" min="1" max="15" value="5" step="1"><span id="stab-sm-v">5</span></label>
        <label>Crop <input type="range" id="stab-cr" min="0" max="30" value="10" step="1"><span id="stab-cr-v">10</span>%</label>
      </div>
      <div id="stab-status" class="ai-status">Pilih video untuk memulai</div>
      <div id="stab-result" class="ai-result"></div>
    `,
    cg:`
      <div class="tool-head"><h2>Color Grading</h2><p>Filter warna sinematik dengan CSS filter — real-time preview</p></div>
      <input type="file" id="cg-file" accept="image/*" style="display:none">
      <div class="row">
        <button class="btn primary" onclick="document.getElementById('cg-file').click()">🖼 Pilih Foto</button>
      </div>
      <div class="cg-presets">
        ${Object.entries(PRESETS).map(([k,v])=>`<button class="cg-preset" data-p="${k}">${v.name}</button>`).join("")}
      </div>
      <div class="cg-sliders">
        <label>Brightness <input type="range" id="cg-bright" min="-50" max="50" value="0"><span id="cg-bright-v">0</span></label>
        <label>Contrast <input type="range" id="cg-contrast" min="-50" max="50" value="0"><span id="cg-contrast-v">0</span></label>
        <label>Saturation <input type="range" id="cg-sat" min="-50" max="50" value="0"><span id="cg-sat-v">0</span></label>
        <label>Hue <input type="range" id="cg-hue" min="-180" max="180" value="0"><span id="cg-hue-v">0</span></label>
      </div>
      <input type="hidden" id="cg-preset" value="none">
      <div id="cg-preview" class="ai-preview"></div>
      <div class="row"><button class="btn primary" id="cg-dl">⬇ Download PNG</button></div>
      <div class="cg-css"><span class="key">CSS:</span> <code id="cg-css">filter: none;</code></div>
    `
  };
  Object.entries(sections).forEach(([id,html])=>{
    if($("tool-"+id))return;
    const s=document.createElement("section");s.id="tool-"+id;s.className="tool";
    s.innerHTML=html;
    const anchor=ct.querySelector("#tool-youtube")||ct.querySelector("#tool-hands");
    if(anchor&&anchor.nextSibling)ct.insertBefore(s,anchor.nextSibling);else ct.appendChild(s)
  });

  if(window.TOOL_TITLES){window.TOOL_TITLES.ai="AI Upscale HD";window.TOOL_TITLES.stab="Video Stabilizer";window.TOOL_TITLES.cg="Color Grading"}

  // Nav handler
  nav.addEventListener("click",e=>{
    const b=e.target.closest("button[data-tool]");if(!b)return;
    const id=b.dataset.tool;
    if(!["ai","stab","cg"].includes(id))return;
    document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active"));
    const tg=$("tool-"+id);if(tg)tg.classList.add("active");
    const ti=$("current-tool-title");if(ti)ti.textContent=window.TOOL_TITLES[id];
    localStorage.setItem("lastTool",id);
    $("sidebar")&&$("sidebar").classList.remove("open");
    $("overlay")&&$("overlay").classList.remove("show");
    if(tg&&!tg.dataset.bound){tg.dataset.bound="1";bind(id)}
  });

  if(typeof window.applyIcons==="function")window.applyIcons()
}

function bind(id){
  if(id==="ai"){
    $("ai-file-img").addEventListener("change",e=>{const f=e.target.files[0];if(f)upscaleImage(f)});
    $("ai-file-vid").addEventListener("change",e=>{const f=e.target.files[0];if(f)upscaleVideo(f)})
  }
  if(id==="stab"){
    ["str","sm","cr"].forEach(k=>{
      const el=$("stab-"+k),v=$("stab-"+k+"-v");
      if(el&&v)el.addEventListener("input",()=>v.textContent=el.value)
    });
    $("stab-file").addEventListener("change",e=>{
      const f=e.target.files[0];if(!f)return;
      stabilizeVideo(f,+$("stab-str").value/10,+$("stab-sm").value,+$("stab-cr").value)
    })
  }
  if(id==="cg"){
    $("cg-file").addEventListener("change",e=>{
      const f=e.target.files[0];if(!f)return;
      const url=URL.createObjectURL(f);
      out("cg-preview",`<img id="cg-img" src="${url}" class="ai-img">`);
      applyFilters()
    });
    document.querySelectorAll(".cg-preset").forEach(b=>{
      b.addEventListener("click",()=>{
        document.querySelectorAll(".cg-preset").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        $("cg-preset").value=b.dataset.p;
        applyFilters()
      })
    });
    ["bright","contrast","sat","hue"].forEach(k=>{
      const el=$("cg-"+k),v=$("cg-"+k+"-v");
      if(el&&v)el.addEventListener("input",()=>{v.textContent=el.value;applyFilters()})
    });
    $("cg-dl").addEventListener("click",cgDownload)
  }
}

function boot(){
  if(!document.getElementById("tool-hash"))return;
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,600));else setTimeout(boot,600);
})();
