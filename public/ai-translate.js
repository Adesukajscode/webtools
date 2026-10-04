(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
const LANGS=[
  ["id","🇮🇩 Indonesia"],["en","🇬🇧 English"],["ja","🇯🇵 日本語"],["ko","🇰🇷 한국어"],
  ["zh","🇨🇳 中文"],["es","🇪🇸 Español"],["fr","🇫🇷 Français"],["de","🇩🇪 Deutsch"],
  ["ar","🇸🇦 العربية"],["ru","🇷🇺 Русский"],["pt","🇵🇹 Português"],["it","🇮🇹 Italiano"],
  ["hi","🇮🇳 हिन्दी"],["th","🇹🇭 ไทย"],["vi","🇻🇳 Tiếng Việt"],["ms","🇲🇾 Melayu"],
  ["tr","🇹🇷 Türkçe"],["nl","🇳🇱 Nederlands"],["pl","🇵🇱 Polski"],["sv","🇸🇪 Svenska"]
];
let hist=[],favs=[];
try{hist=JSON.parse(localStorage.getItem("ct_tr_hist")||"[]")}catch(e){hist=[]}
try{favs=JSON.parse(localStorage.getItem("ct_tr_fav")||"[]")}catch(e){favs=[]}
const sh=()=>{try{localStorage.setItem("ct_tr_hist",JSON.stringify(hist.slice(0,30)))}catch(e){}};
const sf=()=>{try{localStorage.setItem("ct_tr_fav",JSON.stringify(favs.slice(0,20)))}catch(e){}};

async function detectLang(t){
  if(/[\u3040-\u30ff]/.test(t))return"ja";
  if(/[\uac00-\ud7af]/.test(t))return"ko";
  if(/[\u4e00-\u9fff]/.test(t))return"zh";
  if(/[\u0600-\u06ff]/.test(t))return"ar";
  if(/[\u0400-\u04ff]/.test(t))return"ru";
  if(/[\u0900-\u097f]/.test(t))return"hi";
  if(/[\u0e00-\u0e7f]/.test(t))return"th";
  if(/\b(the|and|is|are|you|hello|what|how|this|that)\b/i.test(t))return"en";
  return"id"
}

async function translate(text,from,to){
  const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0,500))}&langpair=${from}|${to}`;
  const r=await fetch(url);if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();
  if(d.responseStatus!==200)throw Error(d.responseDetails||"Gagal");
  return d.responseData.translatedText
}

async function go(){
  const src=$("tr-src").value.trim();
  if(!src)return T("Masukkan teks dulu","error");
  let from=$("tr-from").value,to=$("tr-to").value;
  if(from==="auto"){from=await detectLang(src);T("🌐 Terdeteksi: "+from,"info")}
  $("tr-out").innerHTML='<div class="dim">⏳ Menerjemahkan...</div>';
  try{
    const r=await translate(src,from,to);
    hist.unshift({src,out:r,from,to,ts:Date.now()});sh();
    renderOut(src,r,from,to);
    renderHist();
    // Auto-save ke fav kalau kosong
  }catch(e){$("tr-out").innerHTML=`<div class="err">❌ ${e.message}</div>`}
}

function renderOut(src,out,from,to){
  $("tr-out").innerHTML=`<div class="tr-result">
    <div class="tr-result-text">${out.replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]))}</div>
    <div class="tr-result-actions">
      <button class="btn primary" id="tr-copy">📋 Copy</button>
      <button class="btn" id="tr-speak">🔊 Bicara</button>
      <button class="btn" id="tr-swap2">🔁 Swap</button>
      <button class="btn" id="tr-fav">⭐ Simpan</button>
    </div>
    <div class="tr-result-meta">${from} → ${to} · ${out.length} char · ${src.split(/\s+/).length} kata</div>
  </div>`;
  $("tr-copy").onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(out).then(()=>T("Dicopy","success"))};
  $("tr-speak").onclick=()=>{
    if(!window.speechSynthesis)return T("TTS tidak tersedia","error");
    const u=new SpeechSynthesisUtterance(out);u.lang=to;u.rate=0.95;
    speechSynthesis.cancel();speechSynthesis.speak(u)
  };
  $("tr-swap2").onclick=swap;
  $("tr-fav").onclick=()=>{
    favs.unshift({src,out,from,to,ts:Date.now()});sf();renderFav();T("⭐ Disimpan","success")
  }
}

function swap(){
  const f=$("tr-from").value,t=$("tr-to").value;
  if(f!=="auto")$("tr-from").value=t;
  $("tr-to").value=f==="auto"?"id":f;
  const out=document.querySelector(".tr-result-text");
  if(out){$("tr-src").value=out.textContent;$("tr-out").innerHTML=""}
  else{$("tr-from").value=t;$("tr-to").value=f==="auto"?"id":f}
}

async function batchGo(){
  const ta=$("tr-batch").value.trim();
  if(!ta)return T("Masukkan teks","error");
  const lines=ta.split("\n").filter(Boolean).slice(0,20);
  const from=$("tr-from").value,to=$("tr-to").value;
  const fromF=from==="auto"?await detectLang(lines[0]):from;
  const el=$("tr-batch-out");
  el.innerHTML=`<div class="dim">⏳ Batch (${lines.length})...</div>`;
  const rs=await Promise.all(lines.map(async(line,i)=>{
    try{const r=await translate(line,fromF,to);return{ok:!0,src:line,out:r}}
    catch(e){return{ok:!1,src:line,error:e.message}}
  }));
  el.innerHTML=`<div class="tr-batch-result">${rs.map((r,i)=>`
    <div class="tr-batch-row">
      <div class="tr-batch-num">${i+1}</div>
      <div class="tr-batch-content">
        <div class="tr-batch-src">${r.src.replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</div>
        <div class="tr-batch-out">${r.ok?r.out.replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c])):"❌ "+r.error}</div>
      </div>
    </div>`).join("")}</div>`;
  T("Batch selesai","success")
}

function renderHist(){
  const el=$("tr-hist");if(!el)return;
  if(!hist.length){el.innerHTML="";return}
  el.innerHTML=`<div class="tr-hist-head"><span>🕐 Riwayat (${hist.length})</span><button class="tr-clrh" id="tr-clrh">🗑</button></div>
  <div class="tr-hist-list">${hist.map((h,i)=>`<div class="tr-hist-item" data-i="${i}">
    <div class="tr-hist-src">${h.src.slice(0,60)}${h.src.length>60?"...":""}</div>
    <div class="tr-hist-out">→ ${h.out.slice(0,60)}${h.out.length>60?"...":""}</div>
    <div class="tr-hist-meta">${h.from}→${h.to}</div>
  </div>`).join("")}</div>`;
  $("tr-clrh").onclick=()=>{if(confirm("Hapus riwayat?")){hist=[];sh();renderHist()}};
  el.querySelectorAll(".tr-hist-item").forEach(x=>x.onclick=()=>{
    const h=hist[+x.dataset.i];
    $("tr-src").value=h.src;$("tr-from").value=h.from;$("tr-to").value=h.to;
    renderOut(h.src,h.out,h.from,h.to)
  })
}

function renderFav(){
  const el=$("tr-fav-list");if(!el)return;
  if(!favs.length){el.innerHTML="";return}
  el.innerHTML=`<div class="tr-fav-head">⭐ Favorit (${favs.length})</div>
  <div class="tr-fav-list-grid">${favs.map((h,i)=>`<div class="tr-fav-item" data-i="${i}">
    <div class="tr-fav-src">${h.src.slice(0,40)}</div>
    <button class="tr-fav-del" data-i="${i}">✕</button>
  </div>`).join("")}</div>`;
  el.querySelectorAll(".tr-fav-item").forEach(x=>{
    x.onclick=e=>{
      if(e.target.classList.contains("tr-fav-del")){
        favs.splice(+e.target.dataset.i,1);sf();renderFav();T("Dihapus","success");return
      }
      const h=favs[+x.dataset.i];
      $("tr-src").value=h.src;$("tr-from").value=h.from;$("tr-to").value=h.to;
      renderOut(h.src,h.out,h.from,h.to)
    }
  })
}

function build(){
  if($("tool-aitr"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="aitr"]')){
    const b=document.createElement("button");b.dataset.tool="aitr";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg></span> Translator';
    const a=nav.querySelector('button[data-tool="text"]');if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-aitr")){
    const s=document.createElement("section");s.id="tool-aitr";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🌐 AI Translator</h2><p>20 bahasa · auto-detect · batch · history · TTS · favorite</p></div>
    <div class="tr-tabs">
      <button class="tr-tab active" data-tab="single">📝 Single</button>
      <button class="tr-tab" data-tab="batch">📊 Batch</button>
    </div>
    <div class="tr-panel active" data-panel="single">
      <div class="tr-row">
        <select id="tr-from" class="tr-select"><option value="auto">🌐 Auto-Detect</option>${LANGS.map(l=>`<option value="${l[0]}">${l[1]}</option>`).join("")}</select>
        <button class="btn" id="tr-swap">🔁</button>
        <select id="tr-to" class="tr-select">${LANGS.map(l=>`<option value="${l[0]}"${l[0]==="en"?" selected":""}>${l[1]}</option>`).join("")}</select>
      </div>
      <textarea id="tr-src" class="tr-textarea" placeholder="Ketik atau paste teks... (Ctrl+Enter untuk terjemahkan)" rows="6"></textarea>
      <div class="row"><button class="btn primary" id="tr-go">🚀 Terjemahkan</button><span class="dim" id="tr-count">0/5000</span></div>
      <div id="tr-out" class="tr-out"></div>
    </div>
    <div class="tr-panel" data-panel="batch">
      <textarea id="tr-batch" class="tr-textarea" placeholder="Satu baris satu kalimat — max 20 baris" rows="8"></textarea>
      <div class="row"><button class="btn primary" id="tr-batch-go">📊 Batch Translate</button></div>
      <div id="tr-batch-out" class="tr-batch-out"></div>
    </div>
    <div id="tr-hist" class="tr-hist"></div>
    <div id="tr-fav-list" class="tr-fav-list"></div>`;
    ct.appendChild(s);
    s.querySelectorAll(".tr-tab").forEach(t=>{
      t.onclick=()=>{
        s.querySelectorAll(".tr-tab").forEach(x=>x.classList.remove("active"));
        s.querySelectorAll(".tr-panel").forEach(x=>x.classList.remove("active"));
        t.classList.add("active");
        s.querySelector(`[data-panel="${t.dataset.tab}"]`).classList.add("active")
      }
    })
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.aitr="AI Translator";
  $("tr-go").onclick=go;
  $("tr-swap").onclick=swap;
  $("tr-batch-go").onclick=batchGo;
  $("tr-src").addEventListener("input",e=>{$("tr-count").textContent=e.target.value.length+"/5000"});
  $("tr-src").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.ctrlKey)go()});
  renderHist();renderFav()
}
if(window.registerTool)window.registerTool("aitr",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));else setTimeout(build,900);
window.Translator={hist:()=>hist,favs:()=>favs};
})();
