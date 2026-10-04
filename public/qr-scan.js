(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
const KEY_HIST="ct_qr_hist",KEY_PREF="ct_qr_pref";
let stream=null,vid=null,cv=null,on=!1,raf=null,det=null,loaded=!1,last="";
let hist=[],pref={autoCopy:!1,vibrate:!0,continuous:!1};

try{hist=JSON.parse(localStorage.getItem(KEY_HIST)||"[]")}catch(e){hist=[]}
try{pref={...pref,...JSON.parse(localStorage.getItem(KEY_PREF)||"{}")}}catch(e){}
const saveHist=()=>{try{localStorage.setItem(KEY_HIST,JSON.stringify(hist.slice(0,30)))}catch(e){}};
const savePref=()=>{try{localStorage.setItem(KEY_PREF,JSON.stringify(pref))}catch(e){}};

async function loadJSQR(){
  if(window.jsQR)return!0;if(loaded)return!1;
  try{await new Promise((r,j)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";s.onload=r;s.onerror=j;document.head.appendChild(s)});loaded=!0;return!0}catch(e){return!1}
}

async function initDet(){
  if("BarcodeDetector"in window){
    try{const sup=await BarcodeDetector.getSupportedFormats();
      if(sup.includes("qr_code"))det=new BarcodeDetector({formats:["qr_code"]})}catch(e){}
  }
  if(!det)await loadJSQR()
}

async function camStart(){
  const A=[
    {video:{facingMode:{exact:"environment"},width:{ideal:640},height:{ideal:480}},audio:!1},
    {video:{facingMode:"environment"},audio:!1},{video:!0,audio:!1}];
  let e;for(const c of A){try{stream=await navigator.mediaDevices.getUserMedia(c);return}catch(x){e=x}}
  throw e||Error("Kamera gagal")
}
function camStop(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}if(vid)vid.srcObject=null}

async function scanLoop(){
  if(!on)return;
  if(vid.readyState>=2){
    cv.width=vid.videoWidth;cv.height=vid.videoHeight;
    const c=cv.getContext("2d");c.drawImage(vid,0,0);
    // Corner overlay
    c.strokeStyle="rgba(59,130,246,0.9)";c.lineWidth=4;c.setLineDash([12,8]);
    const cw=cv.width*0.6,ch=cv.height*0.6,x0=(cv.width-cw)/2,y0=(cv.height-ch)/2;
    c.strokeRect(x0,y0,cw,ch);c.setLineDash([]);
    try{
      let code=null;
      if(det){const b=await det.detect(cv);if(b.length)code=b[0].rawValue}
      else if(window.jsQR){
        const px=c.getImageData(0,0,cv.width,cv.height);
        const r=window.jsQR(px.data,px.width,px.height,{inversionAttempts:"dontInvert"});
        if(r&&r.data)code=r.data
      }
      if(code&&code!==last){last=code;onHit(code)}
      else if(!code&&pref.continuous)last="";
    }catch(e){}
  }
  raf=requestAnimationFrame(scanLoop)
}

function classify(text){
  if(/^https?:\/\//i.test(text))return{type:"url",icon:"🔗",label:"URL"};
  if(/^mailto:/i.test(text))return{type:"mail",icon:"✉️",label:"Email"};
  if(/^tel:/i.test(text))return{type:"tel",icon:"📞",label:"Telepon"};
  if(/^WIFI:/i.test(text))return{type:"wifi",icon:"📶",label:"WiFi"};
  if(/^BEGIN:VCARD/i.test(text))return{type:"vcard",icon:"👤",label:"Kontak"};
  if(/^BEGIN:VEVENT/i.test(text))return{type:"event",icon:"📅",label:"Event"};
  if(/^geo:/i.test(text))return{type:"geo",icon:"📍",label:"Lokasi"};
  if(/^[0-9+\-\s]{8,}$/.test(text))return{type:"num",icon:"#️⃣",label:"Angka"};
  return{type:"text",icon:"📝",label:"Teks"}
}

function parseWifi(text){
  try{
    const m=text.match(/S:([^;]+)/),p=text.match(/P:([^;]+)/),t=text.match(/T:([^;]+)/);
    return{ssid:m?m[1]:"",pass:p?p[1]:"",type:t?t[1]:"WPA"}
  }catch(e){return null}
}

function onHit(text){
  const cls=classify(text);
  const entry={text,type:cls.type,ts:Date.now()};
  if(!hist.length||hist[0].text!==text){hist.unshift(entry);saveHist()}
  showResult(text,cls);
  T("✅ "+cls.label+" terdeteksi","success");
  if(pref.vibrate&&navigator.vibrate)navigator.vibrate([60,40,60]);
  if(pref.autoCopy&&navigator.clipboard)navigator.clipboard.writeText(text).then(()=>T("Auto-copy ✅","success"));
  renderHist()
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function showResult(text,cls){
  const el=$("qr-result");if(!el)return;
  const e=esc(text);
  let extra="";
  if(cls.type==="wifi"){
    const w=parseWifi(text);
    if(w)extra=`<div class="qr-info"><b>SSID:</b> ${esc(w.ssid)} · <b>Pass:</b> ${esc(w.pass)} · <b>Type:</b> ${esc(w.type)}</div>`
  }
  if(cls.type==="vcard"){
    const n=text.match(/FN:([^\n]+)/),t=text.match(/TEL[^:]*:([^\n]+)/),em=text.match(/EMAIL[^:]*:([^\n]+)/);
    extra=`<div class="qr-info">${n?`<b>Nama:</b> ${esc(n[1])}<br>`:""}${t?`<b>Telp:</b> ${esc(t[1])}<br>`:""}${em?`<b>Email:</b> ${esc(em[1])}`:""}</div>`
  }
  if(cls.type==="geo"){
    const c=text.replace(/^geo:/,"").split(",");
    if(c.length>=2)extra=`<div class="qr-info"><a href="https://maps.google.com/?q=${c[0]},${c[1]}" target="_blank">🗺️ Buka di Maps</a></div>`
  }
  el.innerHTML=`<div class="qr-hit">
    <div class="qr-hit-head"><span class="qr-hit-icon">${cls.icon}</span><span class="qr-hit-label">${cls.label}</span></div>
    <div class="qr-hit-text">${e}</div>
    ${extra}
    <div class="qr-hit-actions">
      <button class="btn primary" id="qr-copy">📋 Copy</button>
      <button class="btn" id="qr-share">📤 Share</button>
      ${cls.type==="url"?`<a class="btn primary" href="${e}" target="_blank" rel="noopener">🔗 Buka</a>`:""}
      ${cls.type==="tel"?`<a class="btn primary" href="${e}">📞 Telepon</a>`:""}
      ${cls.type==="mail"?`<a class="btn primary" href="${e}">✉️ Email</a>`:""}
    </div>
  </div>`;
  $("qr-copy").onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>T("Dicopy","success"))};
  $("qr-share").onclick=()=>{
    if(navigator.share)navigator.share({text}).catch(()=>{});
    else T("Web Share tidak didukung","error")
  }
}

function renderHist(){
  const el=$("qr-hist");if(!el)return;
  if(!hist.length){el.innerHTML="";return}
  el.innerHTML=`<div class="qr-hist-head"><span>🕐 Riwayat (${hist.length})</span><button class="qr-clear" id="qr-clrh">🗑 Hapus</button></div>
  <div class="qr-hist-list">${hist.map((h,i)=>`
    <div class="qr-hist-item" data-i="${i}">
      <div class="qr-hist-text">${esc(h.text.slice(0,80))}${h.text.length>80?"...":""}</div>
      <div class="qr-hist-meta">${classify(h.text).icon} ${new Date(h.ts).toLocaleString("id-ID",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"short"})}</div>
    </div>`).join("")}</div>`;
  $("qr-clrh").onclick=()=>{if(confirm("Hapus semua riwayat?")){hist=[];saveHist();renderHist();T("Dihapus","success")}};
  el.querySelectorAll(".qr-hist-item").forEach(el=>{
    el.onclick=()=>{
      const h=hist[+el.dataset.i];
      showResult(h.text,classify(h.text))
    }
  })
}

// ═══ GENERATOR ═══
async function ensureQRGen(){
  if(window.QRCode)return!0;
  try{
    await new Promise((r,j)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";s.onload=r;s.onerror=j;document.head.appendChild(s)});
    return!0
  }catch(e){return!1}
}

async function generate(){
  const text=$("qr-gen-text").value.trim();
  if(!text)return T("Masukkan teks dulu","error");
  const ok=await ensureQRGen();
  if(!ok)return T("Gagal load QR generator","error");
  const size=+$("qr-gen-size").value||256;
  const color=$("qr-gen-color").value;
  const el=$("qr-gen-out");
  el.innerHTML='<div class="dim">⏳ Generate...</div>';
  try{
    const canvas=document.createElement("canvas");
    await window.QRCode.toCanvas(canvas,text,{width:size,margin:2,color:{dark:color,light:"#ffffff"},errorCorrectionLevel:"M"});
    const url=canvas.toDataURL("image/png");
    el.innerHTML=`<div class="qr-gen-card"><div class="qr-gen-img-wrap"><img src="${url}" class="qr-gen-img"></div>
      <div class="qr-gen-actions">
        <button class="btn primary" id="qr-gen-dl">⬇ PNG</button>
        <button class="btn" id="qr-gen-copy">📋 Copy URL Data</button>
        <button class="btn" id="qr-gen-svg">📐 SVG</button>
      </div>
      <div class="qr-gen-meta">${size}×${size}px · ${text.length} char</div></div>`;
    $("qr-gen-dl").onclick=()=>{const a=document.createElement("a");a.href=url;a.download=`qr-${Date.now()}.png`;a.click();T("Download dimulai","success")};
    $("qr-gen-copy").onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>T("dataURL dicopy","success"))};
    $("qr-gen-svg").onclick=async()=>{
      try{
        const svg=await window.QRCode.toString(text,{type:"svg",margin:2,color:{dark:color,light:"#ffffff"}});
        const blob=new Blob([svg],{type:"image/svg+xml"});
        const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`qr-${Date.now()}.svg`;a.click();T("SVG diunduh","success")
      }catch(e){T("SVG gagal","error")}
    }
  }catch(e){el.innerHTML=`<div class="err">❌ ${e.message}</div>`}
}

function build(){
  if($("tool-qrscan"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="qrscan"]')){
    const b=document.createElement("button");b.dataset.tool="qrscan";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="21"/><line x1="21" y1="14" x2="14" y2="21"/></svg></span> QR Scanner';
    const a=nav.querySelector('button[data-tool="qr"]');if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-qrscan")){
    const s=document.createElement("section");s.id="tool-qrscan";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>📷 QR Toolkit</h2><p>Scan + Generate + Riwayat · Native detector + jsQR fallback</p></div>
    <div class="qr-tabs">
      <button class="qr-tab active" data-tab="scan">📷 Scan</button>
      <button class="qr-tab" data-tab="gen">🎨 Generate</button>
    </div>
    <div class="qr-panel active" data-panel="scan">
      <div class="qr-prefs">
        <label><input type="checkbox" id="qr-pref-vibrate" ${pref.vibrate?"checked":""}> Getar</label>
        <label><input type="checkbox" id="qr-pref-copy" ${pref.autoCopy?"checked":""}> Auto-copy</label>
        <label><input type="checkbox" id="qr-pref-cont" ${pref.continuous?"checked":""}> Scan kontinu</label>
      </div>
      <div class="qr-stage"><video id="qr-video" playsinline muted></video><canvas id="qr-canvas"></canvas><div class="qr-status" id="qr-status">Siap scan</div></div>
      <div class="row"><button class="btn primary" id="qr-start">▶ Mulai Scan</button></div>
      <div id="qr-result" class="qr-result"></div>
      <div id="qr-hist" class="qr-hist"></div>
    </div>
    <div class="qr-panel" data-panel="gen">
      <textarea id="qr-gen-text" class="qr-gen-textarea" placeholder="Teks / URL / WiFi:WPA;S:...;P:... / mailto:..." rows="3"></textarea>
      <div class="qr-gen-opt">
        <label>Size</label>
        <select id="qr-gen-size"><option value="128">128×128</option><option value="256" selected>256×256</option><option value="512">512×512</option><option value="1024">1024×1024</option></select>
        <label>Warna</label>
        <input type="color" id="qr-gen-color" value="#000000">
      </div>
      <div class="row"><button class="btn primary" id="qr-gen-btn">✨ Generate QR</button></div>
      <div id="qr-gen-out" class="qr-gen-out"></div>
    </div>`;
    ct.appendChild(s);
    // Bind prefs
    $("qr-pref-vibrate").onchange=e=>{pref.vibrate=e.target.checked;savePref()};
    $("qr-pref-copy").onchange=e=>{pref.autoCopy=e.target.checked;savePref()};
    $("qr-pref-cont").onchange=e=>{pref.continuous=e.target.checked;savePref()};
    // Tabs
    s.querySelectorAll(".qr-tab").forEach(t=>{
      t.onclick=()=>{
        s.querySelectorAll(".qr-tab").forEach(x=>x.classList.remove("active"));
        s.querySelectorAll(".qr-panel").forEach(x=>x.classList.remove("active"));
        t.classList.add("active");
        s.querySelector(`[data-panel="${t.dataset.tab}"]`).classList.add("active")
      }
    });
    $("qr-start").onclick=()=>{on?stop():start()};
    $("qr-gen-btn").onclick=generate;
    renderHist()
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.qrscan="QR Toolkit";
}
async function start(){
  const btn=$("qr-start");if(!btn)return;
  btn.disabled=!0;btn.textContent="⏳ Loading...";
  try{
    await initDet();await camStart();
    vid=$("qr-video");vid.srcObject=stream;vid.setAttribute("playsinline","");vid.muted=!0;
    await vid.play();cv=$("qr-canvas");on=!0;last="";
    raf=requestAnimationFrame(scanLoop);
    btn.textContent="⏹ Stop";btn.classList.remove("primary");btn.classList.add("danger");
    btn.disabled=!1;
    const st=$("qr-status");if(st)st.textContent=det?"📷 Native detector":"📷 jsQR mode";
    T(det?"Native detector aktif":"jsQR fallback","success")
  }catch(e){btn.disabled=!1;btn.textContent="▶ Mulai Scan";T("Gagal: "+e.message,"error")}
}
function stop(){on=!1;if(raf)cancelAnimationFrame(raf);camStop();
  const btn=$("qr-start");if(btn){btn.textContent="▶ Mulai Scan";btn.classList.remove("danger");btn.classList.add("primary")}}

if(window.registerTool)window.registerTool("qrscan",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));else setTimeout(build,900);
window.QRScan={start,stop,hist:()=>hist,clearHist:()=>{hist=[];saveHist();renderHist()}};
})();
