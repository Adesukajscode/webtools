(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
const API="https://image.pollinations.ai/prompt";
const STYLES=[
  ["none","Tanpa Style"],
  ["photorealistic, 8k, ultra detailed, professional photography","📷 Realistic"],
  ["digital art, vibrant colors, trending on artstation","🎨 Digital Art"],
  ["anime style, studio ghibli, detailed, colorful","🎌 Anime"],
  ["oil painting, classical, rembrandt lighting","🖼 Oil Painting"],
  ["cyberpunk, neon lights, futuristic, blade runner style","🌆 Cyberpunk"],
  ["3d render, octane render, unreal engine, hyper realistic","🧊 3D Render"],
  ["watercolor, soft colors, artistic","💧 Watercolor"],
  ["pixel art, 16-bit, retro game style","👾 Pixel Art"],
  ["pencil sketch, black and white, detailed lineart","✏️ Sketch"]
];
const SIZES=[["512","512×512","Square"],["768","768×768","Square HD"],["1024","1024×1024","Square FHD"],["1024x768","1024×768","Landscape"],["768x1024","768×1024","Portrait"]];
const LIBRARY=[
  {n:"🐱 Kucing Astronot",p:"kucing astronot di bulan, senja, cinematic lighting, ultra detailed"},
  {n:"🌆 Kota Cyberpunk",p:"cyberpunk city at night, neon lights, rain, blade runner style"},
  {n:"🐉 Naga Fantasi",p:"epic dragon flying over castle, fantasy art, dramatic lighting"},
  {n:"🌸 Anime Girl",p:"beautiful anime girl with sakura, studio ghibli style"},
  {n:"🦊 Rubah Ajaib",p:"magical glowing fox in enchanted forest, fantasy"},
  {n:"🚀 Spaceship",p:"futuristic spaceship, deep space, nebula background, hyper realistic"},
  {n:"🍕 Pizza Art",p:"pizza slice as planet with cheese ocean, surreal"},
  {n:"🧙 Wizard",p:"old wizard casting spell, magic circle, dramatic"},
  {n:"🐺 Lone Wolf",p:"lone wolf silhouette in snowy mountain, sunset"},
  {n:"💎 Crystal Cave",p:"glowing crystal cave, mysterious, atmospheric"}
];

let hist=[],favs=[];
try{hist=JSON.parse(localStorage.getItem("ct_aigen_hist_v2")||"[]")}catch(e){hist=[]}
try{favs=JSON.parse(localStorage.getItem("ct_aigen_fav")||"[]")}catch(e){favs=[]}
const sh=()=>{try{localStorage.setItem("ct_aigen_hist_v2",JSON.stringify(hist.slice(0,24)))}catch(e){}};
const sf=()=>{try{localStorage.setItem("ct_aigen_fav",JSON.stringify(favs.slice(0,24)))}catch(e){}};

function buildUrl(prompt,opts){
  const{width,height,seed,model,negative,enhance}=opts;
  let full=prompt;
  if(opts.style&&opts.style!=="none")full+=", "+opts.style;
  if(negative)full+=` | negative: ${negative}`;
  const p=new URLSearchParams({width,height,seed,nologo:"true",enhance:enhance?"true":"false",private:"true"});
  if(model&&model!=="flux")p.set("model",model);
  return`${API}/${encodeURIComponent(full)}?${p}`
}

async function generate(){
  const prompt=$("ai-prompt").value.trim();
  if(!prompt)return T("Masukkan prompt dulu","error");
  const size=SIZES.find(s=>s[0]===$("ai-size").value)||SIZES[2];
  const[w,h]=size[0].split("x").map(Number);
  const opts={
    width:w||Number(size[0]),height:h||Number(size[0]),
    seed:$("ai-seed").value||Math.floor(Math.random()*1e6),
    model:$("ai-model").value,style:$("ai-style").value,
    negative:$("ai-negative").value.trim(),enhance:$("ai-enhance").checked
  };
  const url=buildUrl(prompt,opts);
  const st=$("ai-status");st.textContent="⏳ Generating... (10-30s)";st.className="aigen-status aigen-loading";
  const wrap=$("ai-out");
  wrap.innerHTML=`<div class="aigen-loading-shell"><div class="aigen-spinner"></div><div class="aigen-loading-text">AI sedang melukis...</div></div>`;
  const img=new Image();img.crossOrigin="anonymous";
  const t0=Date.now();
  img.onload=()=>{
    const el=((Date.now()-t0)/1000).toFixed(1);
    wrap.innerHTML=`<div class="aigen-result">
      <img src="${url}" class="aigen-img" alt="generated">
      <div class="aigen-actions">
        <button class="btn primary" id="ai-dl">⬇ Download</button>
        <button class="btn" id="ai-regen">🔄 Regenerate</button>
        <button class="btn" id="ai-copyurl">📋 Copy URL</button>
        <button class="btn" id="ai-upscale">🔍 2x Upscale</button>
        <button class="btn" id="ai-fav">⭐ Simpan</button>
      </div>
      <div class="aigen-meta">${size[1]} · seed ${opts.seed} · ${el}s · ${opts.model}</div>
    </div>`;
    st.textContent=`✅ Selesai dalam ${el}s`;st.className="aigen-status aigen-ok";
    $("ai-dl").onclick=()=>{const a=document.createElement("a");a.href=url;a.download=`ai-${Date.now()}.jpg`;document.body.appendChild(a);a.click();a.remove();T("Download dimulai","success")};
    $("ai-regen").onclick=()=>{$("ai-seed").value=Math.floor(Math.random()*1e6);generate()};
    $("ai-copyurl").onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>T("URL dicopy","success"))};
    $("ai-upscale").onclick=()=>{
      const big=url.replace(/width=\d+/,"width=2048").replace(/height=\d+/,"height=2048");
      window.open(big,"_blank")
    };
    $("ai-fav").onclick=()=>{
      if(!favs.find(f=>f.url===url)){favs.unshift({prompt,url,seed:opts.seed,ts:Date.now()});sf();renderFav();T("⭐ Disimpan","success")}
      else T("Sudah di favorit","info")
    };
    hist.unshift({prompt,url,seed:opts.seed,ts:Date.now(),size:size[1]});sh();renderHist()
  };
  img.onerror=()=>{
    st.textContent="❌ Gagal generate — coba lagi";st.className="aigen-status aigen-err";
    wrap.innerHTML=`<div class="err">Gagal load image. Coba lagi beberapa detik.</div>`
  };
  img.src=url
}

async function batchGen(){
  const lines=$("ai-batch").value.trim().split("\n").filter(Boolean).slice(0,8);
  if(!lines.length)return T("Masukkan minimal 1 prompt","error");
  const wrap=$("ai-batch-out");
  wrap.innerHTML=`<div class="aigen-batch-grid">${lines.map((p,i)=>`
    <div class="aigen-batch-card" data-i="${i}">
      <div class="aigen-batch-loading"><div class="aigen-spinner-sm"></div></div>
      <div class="aigen-batch-prompt">${p.slice(0,50)}</div>
    </div>`).join("")}</div>`;
  const size=SIZES.find(s=>s[0]===$("ai-size").value)||SIZES[0];
  const[w,h]=size[0].split("x").map(Number);
  await Promise.all(lines.map((prompt,i)=>new Promise(res=>{
    const url=buildUrl(prompt,{width:w||Number(size[0]),height:h||Number(size[0]),seed:Math.floor(Math.random()*1e6),model:$("ai-model").value,style:$("ai-style").value,negative:"",enhance:!1});
    const img=new Image();img.crossOrigin="anonymous";
    img.onload=()=>{
      const card=wrap.querySelector(`[data-i="${i}"]`);
      card.innerHTML=`<img src="${url}" class="aigen-batch-img"><div class="aigen-batch-prompt">${prompt.slice(0,60)}</div>
      <div class="aigen-batch-actions"><button class="btn-xs" data-act="dl" data-url="${url}">⬇</button><button class="btn-xs" data-act="fav" data-url="${url}" data-p="${encodeURIComponent(prompt)}">⭐</button></div>`;
      res()
    };
    img.onerror=()=>{
      const card=wrap.querySelector(`[data-i="${i}"]`);
      card.innerHTML=`<div class="aigen-batch-err">❌ Gagal</div><div class="aigen-batch-prompt">${prompt.slice(0,50)}</div>`;
      res()
    };
    img.src=url
  })));
  wrap.querySelectorAll(".btn-xs").forEach(b=>{
    b.onclick=()=>{
      if(b.dataset.act==="dl"){
        const a=document.createElement("a");a.href=b.dataset.url;a.download=`ai-batch-${Date.now()}.jpg`;a.click()
      }else{
        const p=decodeURIComponent(b.dataset.p);
        if(!favs.find(f=>f.url===b.dataset.url)){favs.unshift({prompt:p,url:b.dataset.url,ts:Date.now()});sf();renderFav()}
        T("⭐ Disimpan","success")
      }
    }
  })
}

function renderHist(){
  const el=$("ai-hist");if(!el)return;
  if(!hist.length){el.innerHTML="";return}
  el.innerHTML=`<div class="aigen-hist-head"><span>🕐 Riwayat (${hist.length})</span><button class="aigen-clear" id="ai-clrh">🗑</button></div>
  <div class="aigen-hist-grid">${hist.map((h,i)=>`<div class="aigen-hist-item" data-i="${i}" title="${h.prompt.slice(0,60)}">
    <img src="${h.url}" loading="lazy" onerror="this.parentNode.style.display='none'">
  </div>`).join("")}</div>`;
  $("ai-clrh").onclick=()=>{if(confirm("Hapus riwayat?")){hist=[];sh();renderHist()}};
  el.querySelectorAll(".aigen-hist-item").forEach(x=>{
    x.onclick=()=>{
      const h=hist[+x.dataset.i];
      $("ai-prompt").value=h.prompt;
      $("ai-out").innerHTML=`<div class="aigen-result"><img src="${h.url}" class="aigen-img"><div class="aigen-meta">${h.size||""} · seed ${h.seed||""}</div></div>`
    }
  })
}

function renderFav(){
  const el=$("ai-fav-list");if(!el)return;
  if(!favs.length){el.innerHTML="";return}
  el.innerHTML=`<div class="aigen-hist-head"><span>⭐ Favorit (${favs.length})</span></div>
  <div class="aigen-hist-grid">${favs.map((h,i)=>`<div class="aigen-hist-item" data-i="${i}" title="${h.prompt.slice(0,60)}">
    <img src="${h.url}" loading="lazy">
  </div>`).join("")}</div>`;
  el.querySelectorAll(".aigen-hist-item").forEach(x=>{
    x.onclick=()=>{
      const h=favs[+x.dataset.i];
      $("ai-prompt").value=h.prompt;
      $("ai-out").innerHTML=`<div class="aigen-result"><img src="${h.url}" class="aigen-img"></div>`
    }
  })
}

function renderLib(){
  const el=$("ai-lib");if(!el)return;
  el.innerHTML=`<div class="aigen-lib-head">📚 Prompt Library</div>
  <div class="aigen-lib-grid">${LIBRARY.map((l,i)=>`<button class="aigen-lib-item" data-i="${i}">${l.n}</button>`).join("")}</div>`;
  el.querySelectorAll(".aigen-lib-item").forEach(b=>{
    b.onclick=()=>{$("ai-prompt").value=LIBRARY[+b.dataset.i].p;T("Prompt diisi","success")}
  })
}

function build(){
  if($("tool-aigen"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="aigen"]')){
    const b=document.createElement("button");b.dataset.tool="aigen";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></span> AI Image Gen';
    const a=nav.querySelector('button[data-tool="up"]');if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-aigen")){
    const s=document.createElement("section");s.id="tool-aigen";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🎨 AI Image Generator</h2><p>Prompt → gambar · Pollinations Flux/Turbo · Batch · Library · Favorites</p></div>
    <div class="aigen-notice">✨ <strong>100% gratis</strong> tanpa API key. Model: Flux, Turbo, dll. Unlimited.</div>
    <div class="aigen-tabs">
      <button class="aigen-tab active" data-tab="single">🎨 Single</button>
      <button class="aigen-tab" data-tab="batch">📊 Batch</button>
      <button class="aigen-tab" data-tab="lib">📚 Library</button>
    </div>
    <div class="aigen-panel active" data-panel="single">
      <textarea id="ai-prompt" class="aigen-textarea" placeholder="Contoh: kucing astronot di bulan, senja, cinematic lighting, 8k" rows="3"></textarea>
      <div class="aigen-advanced"><details><summary>⚙️ Advanced Options</summary>
        <div class="aigen-opt-row"><label>Style</label><select id="ai-style">${STYLES.map(s=>`<option value="${s[0]}">${s[1]}</option>`).join("")}</select></div>
        <div class="aigen-opt-row"><label>Size</label><select id="ai-size">${SIZES.map(s=>`<option value="${s[0]}"${s[0]==="1024"?" selected":""}>${s[1]} — ${s[2]}</option>`).join("")}</select></div>
        <div class="aigen-opt-row"><label>Model</label><select id="ai-model"><option value="flux">Flux</option><option value="turbo">Turbo (cepat)</option><option value="flux-realism">Flux Realism</option><option value="flux-anime">Flux Anime</option><option value="flux-3d">Flux 3D</option><option value="any-dark">Dark Art</option></select></div>
        <div class="aigen-opt-row"><label>Negative</label><input type="text" id="ai-negative" placeholder="blur, low quality"></div>
        <div class="aigen-opt-row"><label>Seed</label><input type="number" id="ai-seed" placeholder="random"></div>
        <div class="aigen-opt-row aigen-inline"><label><input type="checkbox" id="ai-enhance"> Enhance prompt</label></div>
      </details></div>
      <div class="row"><button class="btn primary" id="ai-go">✨ Generate</button></div>
      <div id="ai-status" class="aigen-status">Masukkan prompt → Generate</div>
      <div id="ai-out" class="aigen-out"></div>
      <div id="ai-hist" class="aigen-hist"></div>
      <div id="ai-fav-list" class="aigen-fav-list"></div>
    </div>
    <div class="aigen-panel" data-panel="batch">
      <textarea id="ai-batch" class="aigen-textarea" placeholder="Satu prompt per baris — max 8" rows="6"></textarea>
      <div class="row"><button class="btn primary" id="ai-batch-go">📊 Batch Generate</button></div>
      <div id="ai-batch-out" class="aigen-batch-out"></div>
    </div>
    <div class="aigen-panel" data-panel="lib"><div id="ai-lib"></div></div>`;
    ct.appendChild(s);
    s.querySelectorAll(".aigen-tab").forEach(t=>{
      t.onclick=()=>{
        s.querySelectorAll(".aigen-tab").forEach(x=>x.classList.remove("active"));
        s.querySelectorAll(".aigen-panel").forEach(x=>x.classList.remove("active"));
        t.classList.add("active");
        s.querySelector(`[data-panel="${t.dataset.tab}"]`).classList.add("active")
      }
    })
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.aigen="AI Image Gen";
  $("ai-go").onclick=generate;
  $("ai-batch-go").onclick=batchGen;
  $("ai-prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.ctrlKey)generate()});
  renderLib();renderHist();renderFav()
}
if(window.registerTool)window.registerTool("aigen",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));else setTimeout(build,900);
window.AIImage={hist:()=>hist,favs:()=>favs,lib:LIBRARY};
})();
