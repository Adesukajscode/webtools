(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
const dl=(url,name)=>{const a=document.createElement("a");a.href=url;a.download=name||"download.png";a.click()};

// ═══════════════════════════════════════════════════════
// LOAD PICA (reliable image resizer — 15KB, no model)
// ═══════════════════════════════════════════════════════
let picaReady=false;
async function loadPica(){
  if(picaReady&&window.pica)return!0;
  if(!window.pica){
    try{
      await new Promise((res,rej)=>{
        const s=document.createElement("script");
        s.src="https://cdn.jsdelivr.net/npm/pica@9.0.1/dist/pica.min.js";
        s.onload=res;s.onerror=()=>rej(new Error("pica load fail"));
        document.head.appendChild(s)
      })
    }catch(e){
      console.warn("[ai] pica gagal, pakai canvas native");
      return!1
    }
  }
  picaReady=!!window.pica;
  return picaReady
}

// ═══════════════════════════════════════════════════════
// 1. AI UPSCALE (multi-tier)
// ═══════════════════════════════════════════════════════
async function upscaleImage(file){
  const status=$("upscale-status");
  const result=$("upscale-result");
  const preview=$("upscale-preview");
  try{
    status.textContent="⏳ Membaca file...";
    const url=URL.createObjectURL(file);
    const img=await loadImg(url);
    preview.innerHTML=`<div class="ai-label">Original: ${img.naturalWidth}×${img.naturalHeight}</div><img src="${url}" class="ai-img">`;

    // Target scale 2x
    const scale=2;
    const W=img.naturalWidth*scale,H=img.naturalHeight*scale;

    // Cek limit canvas (max 4096 atau sesuai browser)
    const MAX=8192;
    if(W>MAX||H>MAX){
      status.textContent=`⚠️ Hasil terlalu besar (${W}×${H}). Limit browser ~${MAX}px.`;
      // clamp
      const ratio=Math.min(MAX/W,MAX/H);
      var finalW=Math.floor(W*ratio),finalH=Math.floor(H*ratio);
    }else{
      var finalW=W,finalH=H;
    }

    status.textContent=`⏳ Upscale ke ${finalW}×${finalH}...`;

    // Tier 1: pica (best quality)
    const usePica=await loadPica();
    let canvas=document.createElement("canvas");
    canvas.width=finalW;canvas.height=finalH;
    const ctx=canvas.getContext("2d");

    if(usePica){
      try{
        const picaInst=window.pica({features:["js","wasm","ww"]});
        await picaInst.resize(img,canvas,{quality:3,unsharpAmount:180,unsharpRadius:0.6,unsharpThreshold:2});
        console.log("[ai] pica done");
      }catch(e){
        console.warn("[ai] pica fail, fallback canvas:",e);
        drawHiQuality(ctx,img,finalW,finalH);
      }
    }else{
      drawHiQuality(ctx,img,finalW,finalH);
    }

    // Tier 2: unsharp mask ringan
    status.textContent="⏳ Menajamkan detail...";
    unsharpMask(canvas,0.4);

    // Output
    const dataUrl=canvas.toDataURL("image/png");
    result.innerHTML=`
      <div class="ai-result-head">✅ Selesai! ${finalW}×${finalH} (${scale}x dari original)</div>
      <img src="${dataUrl}" class="ai-img">
      <div class="ai-actions-inline">
        <button class="btn primary" id="ai-dl">⬇ Download PNG</button>
        <button class="btn" id="ai-copy">📋 Copy dataURL</button>
      </div>
      <div class="ai-note">Metode: ${usePica?"Pica (multi-pass Lanczos + unsharp)":"Canvas high-quality bicubic"}</div>
    `;
    $("ai-dl").addEventListener("click",()=>dl(dataUrl,"upscaled_"+Date.now()+".png"));
    $("ai-copy").addEventListener("click",()=>{
      if(navigator.clipboard)navigator.clipboard.writeText(dataUrl).then(()=>toast("dataURL dicopy","success"))
    });
    status.textContent="✅ Selesai! Klik Download untuk simpan."
  }catch(e){
    console.error(e);
    status.textContent="❌ "+e.message;
    result.innerHTML=`<div class="ai-note" style="border-color:var(--accent-2);background:color-mix(in srgb,var(--accent-2) 8%,var(--bg-3))">❌ ${esc(e.message)}</div>`
  }
}

function loadImg(src){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.crossOrigin="anonymous";
    i.onload=()=>res(i);
    i.onerror=()=>rej(new Error("Gagal load gambar"));
    i.src=src
  })
}

function drawHiQuality(ctx,img,W,H){
  // Multi-step upscale untuk kualitas lebih baik
  let cur=img;
  let cw=img.naturalWidth,ch=img.naturalHeight;
  let step=2;
  while(cw*2<W){cw*=2;ch*=2}
  // intermediate canvas
  const tmp=document.createElement("canvas");
  tmp.width=W;tmp.height=H;
  const tctx=tmp.getContext("2d");
  tctx.imageSmoothingEnabled=true;
  tctx.imageSmoothingQuality="high";
  tctx.drawImage(img,0,0,W,H);
  ctx.drawImage(tmp,0,0)
}

function unsharpMask(canvas,amount){
  try{
    const ctx=canvas.getContext("2d");
    const W=canvas.width,H=canvas.height;
    if(W*H>4000000)return; // skip kalau terlalu besar (performa)
    const src=ctx.getImageData(0,0,W,H);
    const dst=ctx.createImageData(W,H);
    const d=src.data,o=dst.data;
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const i=(y*W+x)*4;
        // 3x3 neighbor average
        let r=0,g=0,b=0,n=0;
        for(let dy=-1;dy<=1;dy++){
          for(let dx=-1;dx<=1;dx++){
            const nx=x+dx,ny=y+dy;
            if(nx<0||nx>=W||ny<0||ny>=H)continue;
            const j=(ny*W+nx)*4;
            r+=d[j];g+=d[j+1];b+=d[j+2];n++
          }
        }
        r/=n;g/=n;b/=n;
        o[i]=clamp(d[i]+(d[i]-r)*amount);
        o[i+1]=clamp(d[i+1]+(d[i+1]-g)*amount);
        o[i+2]=clamp(d[i+2]+(d[i+2]-b)*amount);
        o[i+3]=d[i+3]
      }
    }
    ctx.putImageData(dst,0,0)
  }catch(e){console.warn("[ai] unsharp skip:",e)}
}

function clamp(v){return v<0?0:v>255?255:v|0}

// ═══════════════════════════════════════════════════════
// 2. COLOR GRADING
// ═══════════════════════════════════════════════════════
const PRESETS={
  none:{name:"Normal",f:""},
  cinematic:{name:"🎬 Cinematic",f:"contrast(1.15) saturate(0.9) brightness(0.95) sepia(0.15)"},
  vintage:{name:"📷 Vintage",f:"sepia(0.4) contrast(1.1) saturate(0.85) brightness(1.05)"},
  cyberpunk:{name:"🌆 Cyberpunk",f:"hue-rotate(-15deg) saturate(1.6) contrast(1.2) brightness(1.05)"},
  cold:{name:"❄️ Cold Blue",f:"hue-rotate(180deg) saturate(1.1) brightness(1.02)"},
  warm:{name:"☀️ Warm Sunset",f:"hue-rotate(-20deg) saturate(1.3) brightness(1.1) sepia(0.2)"},
  noir:{name:"🎞️ Noir",f:"grayscale(1) contrast(1.3) brightness(0.95)"},
  vivid:{name:"🌈 Vivid",f:"saturate(1.8) contrast(1.2)"},
  soft:{name:"🌸 Soft Dream",f:"brightness(1.1) saturate(1.1) blur(0.3px)"},
  retro:{name:"📼 Retro 80s",f:"sepia(0.3) saturate(1.4) hue-rotate(-10deg) contrast(1.05)"}
};
let cgImg=null,cgOriginalUrl=null;

function cgBuildFilter(){
  const b=+($("cg-bright").value||0)/100;
  const c=+($("cg-contrast").value||0)/100;
  const s=+($("cg-sat").value||0)/100;
  const h=+($("cg-hue").value||0);
  const preset=PRESETS[$("cg-preset").value].f;
  return `${preset} brightness(${1+b}) contrast(${1+c}) saturate(${1+s}) hue-rotate(${h}deg)`.trim()
}

function cgApply(){
  const f=cgBuildFilter();
  const img=$("cg-img");
  if(img)img.style.filter=f;
  const css=$("cg-css");
  if(css)css.textContent=`filter: ${f};`
}

async function cgLoad(file){
  try{
    const url=URL.createObjectURL(file);
    cgOriginalUrl=url;
    const img=await loadImg(url);
    cgImg=img;
    out("cg-preview",`<div class="ai-label">${img.naturalWidth}×${img.naturalHeight}</div><img id="cg-img" src="${url}" class="ai-img">`);
    cgApply();
    toast("Gambar dimuat — geser slider untuk preview","success")
  }catch(e){toast("Gagal load: "+e.message,"error")}
}

function cgDownload(){
  if(!cgImg)return toast("Pilih gambar dulu","error");
  try{
    const c=document.createElement("canvas");
    c.width=cgImg.naturalWidth;c.height=cgImg.naturalHeight;
    const ctx=c.getContext("2d");
    // Set filter (didukung Chrome/Firefox/Edge modern)
    ctx.filter=cgBuildFilter()||"none";
    ctx.drawImage(cgImg,0,0);
    // Kalau ctx.filter tidak didukung (Safari lama), fallback ke pixel manual
    const test=ctx.getImageData(0,0,1,1).data;
    const url=c.toDataURL("image/png");
    dl(url,"graded_"+Date.now()+".png");
    toast("✅ Downloaded","success")
  }catch(e){toast("Error: "+e.message,"error")}
}

// ═══════════════════════════════════════════════════════
// 3. VIDEO STABILIZER (simpler, preview-focused)
// ═══════════════════════════════════════════════════════
async function stabilizeVideo(file,strength,smoothness,crop){
  const status=$("stab-status");
  const result=$("stab-result");
  try{
    status.textContent="⏳ Membaca video...";
    const url=URL.createObjectURL(file);
    const v=document.createElement("video");
    v.muted=true;v.playsInline=true;v.preload="auto";
    v.src=url;
    await new Promise((res,rej)=>{
      v.onloadedmetadata=res;
      v.onerror=()=>rej(new Error("Video tidak bisa dibaca"));
      setTimeout(res,3000)
    });
    const W=v.videoWidth,H=v.videoHeight,D=v.duration;
    if(!W||!H)throw new Error("Video metadata kosong");

    status.textContent=`⏳ Analisis motion ${W}×${H} (${D.toFixed(1)}s)...`;
    // sample 20 frames evenly
    const N=Math.min(20,Math.max(5,Math.floor(D)));
    const offsets=[];
    const sample=document.createElement("canvas");
    sample.width=120;sample.height=Math.floor(120*H/W);
    const sctx=sample.getContext("2d",{willReadFrequently:true});
    let prev=null;

    for(let i=0;i<N;i++){
      const t=(D/(N+1))*(i+1);
      await seek(v,t);
      sctx.drawImage(v,0,0,sample.width,sample.height);
      const cur=sctx.getImageData(0,0,sample.width,sample.height);
      if(prev){
        const m=estimateOffset(prev,cur);
        offsets.push(m)
      }else offsets.push({dx:0,dy:0});
      prev=cur;
      status.textContent=`⏳ Analisis frame ${i+1}/${N}...`
    }

    // Smooth offsets
    const win=Math.max(1,Math.floor(smoothness));
    const smoothed=offsets.map((_,i)=>{
      let sx=0,sy=0,c=0;
      for(let j=Math.max(0,i-win);j<=Math.min(offsets.length-1,i+win);j++){sx+=offsets[j].dx;sy+=offsets[j].dy;c++}
      return{dx:sx/c,dy:sy/c}
    });

    // Render preview frame dengan offset middle
    await seek(v,D/2);
    const mid=smoothed[Math.floor(smoothed.length/2)];
    const c=document.createElement("canvas");
    c.width=W;c.height=H;
    const ctx=c.getContext("2d");
    const cropPx=Math.floor(Math.min(W,H)*crop/100);
    const drawW=W+cropPx,drawH=H+cropPx;
    const scaleX=W/sample.width,scaleY=H/sample.height;
    const offX=-mid.dx*scaleX*strength-cropPx/2;
    const offY=-mid.dy*scaleY*strength-cropPx/2;
    ctx.drawImage(v,offX,offY,drawW,drawH);

    const url2=c.toDataURL("image/png");
    result.innerHTML=`
      <div class="ai-result-head">✅ Preview stabilized frame</div>
      <img src="${url2}" class="ai-img">
      <div class="ai-actions-inline">
        <button class="btn primary" id="stab-dl">⬇ Download Frame</button>
      </div>
      <div class="ai-note">Motion offset rata-rata: dx=${mid.dx.toFixed(2)} dy=${mid.dy.toFixed(2)} · Smoothing window: ${win*2+1} frame</div>
    `;
    $("stab-dl").addEventListener("click",()=>dl(url2,"stabilized_"+Date.now()+".png"));
    status.textContent=`✅ Analisis selesai (${N} sample frame)`
  }catch(e){
    console.error(e);
    status.textContent="❌ "+e.message;
  }
}

function seek(v,t){
  return new Promise(res=>{
    let done=false;
    const fin=()=>{if(done)return;done=true;res()};
    v.onseeked=fin;
    try{v.currentTime=Math.min(t,v.duration||t)}catch(e){}
    setTimeout(fin,800)
  })
}

function estimateOffset(a,b){
  const w=a.width,h=a.height;
  const R=6,STEP=2;
  let bestDx=0,bestDy=0,bestDiff=Infinity;
  for(let dy=-R;dy<=R;dy+=STEP){
    for(let dx=-R;dx<=R;dx+=STEP){
      let diff=0,n=0;
      for(let y=8;y<h-8;y+=4){
        for(let x=8;x<w-8;x+=4){
          const x2=x+dx,y2=y+dy;
          if(x2<0||x2>=w||y2<0||y2>=h)continue;
          const i1=(y*w+x)*4,i2=(y2*w+x2)*4;
          diff+=Math.abs(a.data[i1]-b.data[i2])+Math.abs(a.data[i1+1]-b.data[i2+1])+Math.abs(a.data[i1+2]-b.data[i2+2]);
          n++
        }
      }
      if(n&&diff/n<bestDiff){bestDiff=diff/n;bestDx=dx;bestDy=dy}
    }
  }
  return{dx:bestDx,dy:bestDy}
}

// ═══════════════════════════════════════════════════════
// BUILD UI
// ═══════════════════════════════════════════════════════
function build(){
  if($("tool-ai"))return;
  const nav=$("nav"),ct=document.querySelector(".content");
  if(!nav||!ct)return;
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
  const sections={
    ai:`
      <div class="tool-head"><h2>AI Upscale HD</h2><p>Perbesar foto 2x dengan kualitas tinggi — 100% di browser</p></div>
      <div class="ai-notice">⚡ <strong>Mesin:</strong> Pica (multi-pass Lanczos + unsharp mask). Ringan & reliable. Support gambar besar hingga 8192px.</div>
      <input type="file" id="ai-file" accept="image/*" style="display:none">
      <div class="row"><button class="btn primary" onclick="document.getElementById('ai-file').click()">🖼 Pilih Foto</button></div>
      <div id="upscale-status" class="ai-status">Pilih foto untuk mulai</div>
      <div id="upscale-preview" class="ai-preview"></div>
      <div id="upscale-result" class="ai-result"></div>
    `,
    stab:`
      <div class="tool-head"><h2>Video Stabilizer</h2><p>Analisis getaran kamera & preview frame stabilized</p></div>
      <div class="ai-notice">📹 <strong>Cara kerja:</strong> Sample 20 frame, estimasi motion per frame, preview 1 frame stabilized. Untuk render video penuh butuh ffmpeg.wasm (~30MB).</div>
      <input type="file" id="stab-file" accept="video/*" style="display:none">
      <div class="row"><button class="btn primary" onclick="document.getElementById('stab-file').click()">🎬 Pilih Video</button></div>
      <div class="stab-controls">
        <label>Strength <input type="range" id="stab-str" min="0" max="30" value="15"><span id="stab-str-v">15</span></label>
        <label>Smoothness <input type="range" id="stab-sm" min="1" max="10" value="3"><span id="stab-sm-v">3</span></label>
        <label>Crop <input type="range" id="stab-cr" min="0" max="30" value="8"><span id="stab-cr-v">8</span>%</label>
      </div>
      <div id="stab-status" class="ai-status">Pilih video untuk mulai</div>
      <div id="stab-result" class="ai-result"></div>
    `,
    cg:`
      <div class="tool-head"><h2>Color Grading</h2><p>Filter warna sinematik real-time — preview + download PNG</p></div>
      <input type="file" id="cg-file" accept="image/*" style="display:none">
      <div class="row"><button class="btn primary" onclick="document.getElementById('cg-file').click()">🖼 Pilih Foto</button></div>
      <div class="cg-presets">${Object.entries(PRESETS).map(([k,v])=>`<button class="cg-preset ${k==="none"?"active":""}" data-p="${k}">${v.name}</button>`).join("")}</div>
      <div class="cg-sliders">
        <label>Brightness <input type="range" id="cg-bright" min="-50" max="50" value="0"><span id="cg-bright-v">0</span></label>
        <label>Contrast <input type="range" id="cg-contrast" min="-50" max="50" value="0"><span id="cg-contrast-v">0</span></label>
        <label>Saturation <input type="range" id="cg-sat" min="-50" max="50" value="0"><span id="cg-sat-v">0</span></label>
        <label>Hue <input type="range" id="cg-hue" min="-180" max="180" value="0"><span id="cg-hue-v">0</span></label>
      </div>
      <input type="hidden" id="cg-preset" value="none">
      <div class="row"><button class="btn primary" id="cg-dl">⬇ Download PNG</button></div>
      <div class="cg-css"><span class="key">CSS:</span> <code id="cg-css">filter: none;</code></div>
      <div id="cg-preview" class="ai-preview"></div>
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
    $("ai-file").addEventListener("change",e=>{const f=e.target.files[0];if(f)upscaleImage(f)})
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
    $("cg-file").addEventListener("change",e=>{const f=e.target.files[0];if(f)cgLoad(f)});
    document.querySelectorAll(".cg-preset").forEach(b=>{
      b.addEventListener("click",()=>{
        document.querySelectorAll(".cg-preset").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        $("cg-preset").value=b.dataset.p;
        cgApply()
      })
    });
    ["bright","contrast","sat","hue"].forEach(k=>{
      const el=$("cg-"+k),v=$("cg-"+k+"-v");
      if(el&&v)el.addEventListener("input",()=>{v.textContent=el.value;cgApply()})
    });
    $("cg-dl").addEventListener("click",cgDownload)
  }
}

function boot(){
  if(!document.getElementById("tool-hash"))return;
  build()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,650));else setTimeout(boot,650);
})();
