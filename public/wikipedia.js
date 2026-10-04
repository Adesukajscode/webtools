(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h};
const toast=window.toast||(m=>console.log(m));
const API="https://id.wikipedia.org/w/api.php";
const REST="https://id.wikipedia.org/api/rest_v1";
let bound=!1;

async function search(q){
  const url=`${API}?action=opensearch&search=${encodeURIComponent(q)}&limit=15&namespace=0&format=json&origin=*`;
  const r=await fetch(url);
  if(!r.ok)throw Error("Search HTTP "+r.status);
  const d=await r.json();
  const titles=d[1]||[],descs=d[2]||[];
  return titles.map((t,i)=>({title:t,desc:descs[i]||""}))
}

async function summary(title){
  // Tier 1: REST API
  try{
    const url=`${REST}/page/summary/${encodeURIComponent(title.replace(/ /g,"_"))}`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      if(d&&d.extract)return d
    }
  }catch(e){console.warn("[wp] REST fail:",e.message)}

  // Tier 2: Action API
  try{
    const url=`${API}?action=query&format=json&origin=*&prop=extracts|pageimages|info&inprop=url&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=400&titles=${encodeURIComponent(title)}`;
    const r=await fetch(url);
    if(!r.ok)throw Error("Action HTTP "+r.status);
    const d=await r.json();
    const pages=d.query&&d.query.pages||{};
    const first=Object.values(pages)[0];
    if(first&&first.extract){
      return{
        title:first.title,
        description:"",
        extract:first.extract,
        thumbnail:first.thumbnail?{source:first.thumbnail.source}:null,
        content_urls:{desktop:{page:first.fullurl||`https://id.wikipedia.org/wiki/${encodeURIComponent(first.title)}`}}
      }
    }
  }catch(e){console.warn("[wp] action fail:",e.message)}

  throw Error("Artikel tidak bisa dimuat")
}

async function random(){
  try{
    const r=await fetch(`${REST}/page/random/summary`);
    if(r.ok)return await r.json()
  }catch(e){}
  const r=await fetch(`${API}?action=query&format=json&origin=*&list=random&rnlimit=1&rnnamespace=0`);
  const d=await r.json();
  const t=d.query.random[0].title;
  return await summary(t)
}

function renderResults(items){
  const el=$("wp-results");
  if(!el)return;
  if(!items.length){el.innerHTML='<div class="wp-empty">Tidak ada hasil. Coba kata kunci lain.</div>';return}
  el.innerHTML=items.map(it=>`
    <div class="wp-item" data-t="${esc(it.title)}" role="button" tabindex="0">
      <div class="wp-item-title">${esc(it.title)}</div>
      <div class="wp-item-desc">${esc(it.desc||"Klik untuk lihat ringkasan")}</div>
    </div>
  `).join("");
}

function renderSummary(d){
  const el=$("wp-summary");
  if(!el)return;
  const thumb=d.thumbnail?`<img src="${esc(d.thumbnail.source)}" alt="" class="wp-thumb" onerror="this.style.display='none'">`:"";
  const link=d.content_urls&&d.content_urls.desktop?d.content_urls.desktop.page:"";
  el.innerHTML=`
    <div class="wp-sum-card">
      ${thumb}
      <div class="wp-sum-body">
        <h3>${esc(d.title)}</h3>
        ${d.description?`<div class="wp-sum-desc">${esc(d.description)}</div>`:""}
        <p>${esc(d.extract||"(Tidak ada ringkasan tersedia)")}</p>
        ${link?`<a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener">📖 Baca lengkap di Wikipedia</a>`:""}
      </div>
    </div>`;
  el.scrollIntoView({behavior:"smooth",block:"start"})
}

async function loadSummary(title){
  const el=$("wp-summary");
  if(el)el.innerHTML=`<div class="wp-loading">⏳ Memuat "${esc(title)}"...</div>`;
  try{
    const d=await summary(title);
    renderSummary(d)
  }catch(e){
    if(el)el.innerHTML=`<div class="wp-empty">❌ ${esc(e.message)}<br><br><a href="https://id.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank" rel="noopener" class="btn">Buka di Wikipedia</a></div>`
  }
}

async function doSearch(){
  const inp=$("wp-input");
  const q=(inp?.value||"").trim();
  if(!q)return toast("Ketik kata kunci dulu","error");
  out("wp-results",'<div class="wp-loading">🔍 Mencari...</div>');
  out("wp-summary","");
  try{
    const items=await search(q);
    renderResults(items)
  }catch(e){
    out("wp-results",`<div class="wp-empty">❌ ${esc(e.message)}</div>`)
  }
}

async function doRandom(){
  out("wp-results","");
  out("wp-summary",'<div class="wp-loading">🎲 Ambil artikel acak...</div>');
  try{
    const d=await random();
    renderSummary(d)
  }catch(e){
    out("wp-summary",`<div class="wp-empty">❌ ${esc(e.message)}</div>`)
  }
}

function init(){
  if(bound)return;bound=!0;
  const input=$("wp-input"),btn=$("wp-search"),rnd=$("wp-random"),results=$("wp-results");
  if(input)input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doSearch()}});
  if(btn)btn.addEventListener("click",doSearch);
  if(rnd)rnd.addEventListener("click",doRandom);
  // DELEGATION
  if(results){
    results.addEventListener("click",e=>{
      const item=e.target.closest(".wp-item");
      if(!item)return;
      const title=item.dataset.t;
      if(title)loadSummary(title)
    });
    results.addEventListener("keydown",e=>{
      if(e.key!=="Enter"&&e.key!==" ")return;
      const item=e.target.closest(".wp-item");
      if(!item)return;
      e.preventDefault();
      const title=item.dataset.t;
      if(title)loadSummary(title)
    })
  }
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
      <div class="tool-head"><h2>📚 Wikipedia</h2><p>Cari artikel, baca ringkasan, atau jelajah artikel acak — dari Wikipedia Indonesia</p></div>
      <div class="wp-notice">🌐 <strong>Sumber:</strong> id.wikipedia.org · API resmi, gratis, tanpa API key.</div>
      <div class="wp-search-row">
        <input type="text" id="wp-input" placeholder="Cari topik... (Soekarno, Python, Jakarta)" autocomplete="off">
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
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,850));else setTimeout(build,850);
})();
