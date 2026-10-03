(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
const API="https://id.wikipedia.org/w/api.php";
const REST="https://id.wikipedia.org/api/rest_v1";

let bound=!1;

async function search(q){
  if(!q)return[];
  const url=`${API}?action=opensearch&search=${encodeURIComponent(q)}&limit=10&namespace=0&format=json&origin=*`;
  const r=await fetch(url);
  const d=await r.json();
  // d = [query, [titles], [descs], [urls]]
  const titles=d[1]||[],descs=d[2]||[],urls=d[3]||[];
  return titles.map((t,i)=>({title:t,desc:descs[i]||"",url:urls[i]||"",lang:"id"}))
}

async function summary(title){
  const url=`${REST}/page/summary/${encodeURIComponent(title)}`;
  const r=await fetch(url);
  if(!r.ok)throw Error("Halaman tidak ditemukan");
  return await r.json()
}

async function random(){
  const r=await fetch(`${REST}/page/random/summary`);
  if(!r.ok)throw Error("Gagal ambil random");
  return await r.json()
}

function renderResults(items){
  const el=$("wp-results");
  if(!el)return;
  if(!items.length){el.innerHTML='<div class="wp-empty">Tidak ada hasil</div>';return}
  el.innerHTML=items.map((it,i)=>`
    <div class="wp-item" data-t="${esc(it.title)}">
      <div class="wp-item-title">${esc(it.title)}</div>
      <div class="wp-item-desc">${esc(it.desc||"Klik untuk lihat ringkasan")}</div>
    </div>
  `).join("");
  el.querySelectorAll(".wp-item").forEach(x=>{
    x.addEventListener("click",()=>loadSummary(x.dataset.t))
  })
}

function renderSummary(d){
  const el=$("wp-summary");
  if(!el)return;
  const thumb=d.thumbnail?`<img src="${esc(d.thumbnail.source)}" alt="" class="wp-thumb">`:"";
  const extract=d.extract||"";
  const link=d.content_urls&&d.content_urls.desktop?d.content_urls.desktop.page:"";
  el.innerHTML=`
    <div class="wp-sum-card">
      ${thumb}
      <div class="wp-sum-body">
        <h3>${esc(d.title)}</h3>
        ${d.description?`<div class="wp-sum-desc">${esc(d.description)}</div>`:""}
        <p>${esc(extract)}</p>
        ${link?`<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">📖 Baca lengkap di Wikipedia</a>`:""}
      </div>
    </div>`;
}

async function loadSummary(title){
  const el=$("wp-summary");
  if(el)el.innerHTML='<div class="wp-loading">⏳ Memuat...</div>';
  try{
    const d=await summary(title);
    renderSummary(d)
  }catch(e){
    if(el)el.innerHTML=`<div class="wp-empty">❌ ${esc(e.message)}</div>`
  }
}

async function doSearch(){
  const q=$("wp-input").value.trim();
  if(!q)return toast("Ketik kata kunci","error");
  out("wp-results",'<div class="wp-loading">🔍 Mencari...</div>');
  out("wp-summary","");
  try{renderResults(await search(q))}
  catch(e){out("wp-results",`<div class="wp-empty">❌ ${esc(e.message)}</div>`)}
}

async function doRandom(){
  out("wp-results","");out("wp-summary",'<div class="wp-loading">🎲 Mengambil artikel acak...</div>');
  try{renderSummary(await random())}
  catch(e){out("wp-summary",`<div class="wp-empty">❌ ${esc(e.message)}</div>`)}
}

function init(){
  if(bound)return;bound=!0;
  const input=$("wp-input"),btn=$("wp-search"),rnd=$("wp-random");
  if(input)input.addEventListener("keydown",e=>{if(e.key==="Enter")doSearch()});
  if(btn)btn.addEventListener("click",doSearch);
  if(rnd)rnd.addEventListener("click",doRandom)
}

function build(){
  if($("tool-wiki"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="wiki"]')){
    const b=document.createElement("button");b.dataset.tool="wiki";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h3l5 12 5-12h3"/><path d="M4 20h16"/></svg></span> Wikipedia';
    const a=nav.querySelector('button[data-tool="slot"]')||nav.querySelector('button[data-tool="youtube"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-wiki")){
    const s=document.createElement("section");s.id="tool-wiki";s.className="tool";
    s.innerHTML=`
      <div class="tool-head"><h2>📚 Wikipedia</h2><p>Cari artikel, baca ringkasan, atau jelajah artikel acak — terintegrasi API resmi Wikipedia</p></div>
      <div class="wp-notice">🌐 <strong>Sumber:</strong> Wikipedia Bahasa Indonesia (id.wikipedia.org). API resmi, gratis, tanpa API key.</div>
      <div class="wp-search-row">
        <input type="text" id="wp-input" placeholder="Cari topik... (contoh: Soekarno, Python, Jakarta)" autocomplete="off">
        <button class="btn primary" id="wp-search">🔍 Cari</button>
        <button class="btn" id="wp-random" title="Artikel acak">🎲 Acak</button>
      </div>
      <div id="wp-results" class="wp-results"></div>
      <div id="wp-summary" class="wp-summary"></div>
    `;
    const a=ct.querySelector("#tool-slot")||ct.querySelector("#tool-youtube");
    if(a&&a.nextSibling)ct.insertBefore(s,a.nextSibling);else ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.wiki="Wikipedia";
  init()
}

if(window.registerTool)window.registerTool("wiki",()=>init());
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,800));else setTimeout(build,800);
})();
