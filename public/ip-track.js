(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
let map=null,marker=null,ll=!1;
let hist=[],favs=[];
try{hist=JSON.parse(localStorage.getItem("ct_ipt_hist")||"[]")}catch(e){hist=[]}
try{favs=JSON.parse(localStorage.getItem("ct_ipt_fav")||"[]")}catch(e){favs=[]}
const sh=()=>{try{localStorage.setItem("ct_ipt_hist",JSON.stringify(hist.slice(0,20)))}catch(e){}};
const sf=()=>{try{localStorage.setItem("ct_ipt_fav",JSON.stringify(favs))}catch(e){}};

async function loadLeaflet(){
  if(window.L)return!0;if(ll)return!1;
  try{
    await new Promise((r,j)=>{
      const c=document.createElement("link");c.rel="stylesheet";c.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(c);
      const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.onload=r;s.onerror=j;document.head.appendChild(s)
    });
    ll=!0;return!0
  }catch(e){return!1}
}

async function lookup(q){
  const el=$("ipt-result");el.innerHTML='<div class="dim">⏳ Lookup...</div>';
  try{
    const url=q?`https://ipwho.is/${encodeURIComponent(q)}`:"https://ipwho.is/";
    const r=await fetch(url);const d=await r.json();
    if(!d.success)return el.innerHTML=`<div class="err">❌ ${d.message||"Gagal"}</div>`;
    if(!hist.length||hist[0].ip!==d.ip){hist.unshift({ip:d.ip,country:d.country,city:d.city,flag:d.flag?.emoji||"🌍",ts:Date.now()});sh()}
    render(d);renderHist()
  }catch(e){el.innerHTML=`<div class="err">❌ ${e.message}</div>`}
}

async function bulkLookup(list){
  const el=$("ipt-result");
  const ips=list.split(/[\n,\s]+/).filter(Boolean).slice(0,10);
  if(!ips.length)return T("Masukkan minimal 1 IP","error");
  el.innerHTML=`<div class="dim">⏳ Bulk lookup (${ips.length})...</div>`;
  const results=await Promise.all(ips.map(async ip=>{
    try{const r=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);const d=await r.json();
      return{ip,ok:d.success,city:d.city,country:d.country,flag:d.flag?.emoji||"🌍",isp:d.connection?.isp,lat:d.latitude,lon:d.longitude}
    }catch(e){return{ip,ok:!1,error:e.message}}
  }));
  el.innerHTML=`<div class="ipt-bulk"><div class="ipt-bulk-head">📊 Bulk Results (${ips.length})</div>
    <div class="ipt-bulk-table">${results.map(r=>r.ok?
      `<div class="ipt-bulk-row" data-ip="${r.ip}">
        <div class="ipt-bulk-ip">${r.ip}</div>
        <div class="ipt-bulk-loc">${r.flag} ${r.city||"?"}, ${r.country||"?"}</div>
        <div class="ipt-bulk-isp">${r.isp||"-"}</div>
      </div>`:
      `<div class="ipt-bulk-row ipt-bulk-err"><div class="ipt-bulk-ip">${r.ip}</div><div class="ipt-bulk-loc">❌ ${r.error||"gagal"}</div></div>`
    ).join("")}</div></div>`;
  el.querySelectorAll(".ipt-bulk-row[data-ip]").forEach(row=>{
    row.onclick=()=>lookup(row.dataset.ip)
  });
  T("Bulk lookup selesai","success")
}

async function render(d){
  const el=$("ipt-result");
  const flag=d.flag?.emoji||"🌍";
  const isFav=favs.includes(d.ip);
  el.innerHTML=`
    <div class="ipt-head">
      <div class="ipt-flag">${flag}</div>
      <div style="flex:1">
        <div class="ipt-ip">${d.ip} <span class="ipt-type">${d.type||""}</span></div>
        <div class="ipt-loc">${d.city||"?"}, ${d.region||"?"} · ${d.country||"?"}</div>
      </div>
      <button class="ipt-fav ${isFav?'on':''}" id="ipt-fav" title="${isFav?'Hapus dari favorit':'Tambah favorit'}">${isFav?'★':'☆'}</button>
    </div>
    <div class="ipt-grid">
      <div class="ipt-kv"><span>ISP</span><b>${d.connection?.isp||"?"}</b></div>
      <div class="ipt-kv"><span>Org</span><b>${d.connection?.org||"?"}</b></div>
      <div class="ipt-kv"><span>ASN</span><b>${d.connection?.asn||"?"}</b></div>
      <div class="ipt-kv"><span>Domain</span><b>${d.connection?.domain||"—"}</b></div>
      <div class="ipt-kv"><span>Lat</span><b>${d.latitude?.toFixed(4)||"?"}</b></div>
      <div class="ipt-kv"><span>Lon</span><b>${d.longitude?.toFixed(4)||"?"}</b></div>
      <div class="ipt-kv"><span>Timezone</span><b>${d.timezone?.id||"?"}</b></div>
      <div class="ipt-kv"><span>UTC</span><b>${d.timezone?.utc||"?"}</b></div>
      <div class="ipt-kv"><span>Postal</span><b>${d.postal||"—"}</b></div>
      <div class="ipt-kv"><span>Continent</span><b>${d.continent||"?"}</b></div>
      <div class="ipt-kv"><span>Currency</span><b>${d.currency?.code||"—"}</b></div>
      <div class="ipt-kv"><span>Calling</span><b>${d.calling_code||"—"}</b></div>
    </div>
    ${d.security?`<div class="ipt-sec">
      <span class="${d.security.proxy?'on':'off'}">Proxy ${d.security.proxy?'✅':'—'}</span>
      <span class="${d.security.vpn?'on':'off'}">VPN ${d.security.vpn?'✅':'—'}</span>
      <span class="${d.security.tor?'on':'off'}">Tor ${d.security.tor?'✅':'—'}</span>
      <span class="${d.security.hosting?'on':'off'}">Hosting ${d.security.hosting?'✅':'—'}</span>
    </div>`:""}
    <div class="ipt-actions">
      <button class="btn" id="ipt-ping">🏓 Ping</button>
      <button class="btn" id="ipt-trace">🌐 Ports</button>
      <button class="btn" id="ipt-whois">📖 WHOIS</button>
      <button class="btn" id="ipt-reverse">🔍 Reverse DNS</button>
    </div>`;
  $("ipt-fav").onclick=()=>{
    const idx=favs.indexOf(d.ip);
    if(idx>=0){favs.splice(idx,1);T("Hapus dari favorit","success")}
    else{favs.push(d.ip);T("Ditambah favorit ⭐","success")}
    sf();render(d);renderFav()
  };
  $("ipt-ping").onclick=()=>T("Ping: gunakan terminal — bukan di browser","info");
  $("ipt-trace").onclick=()=>{
    const url=`https://www.shodan.io/host/${d.ip}`;
    window.open(url,"_blank");
    T("Buka Shodan (butuh akun)","info")
  };
  $("ipt-whois").onclick=()=>{
    const url=`https://who.is/whois-ip/ip-address/${d.ip}`;
    window.open(url,"_blank")
  };
  $("ipt-reverse").onclick=()=>{
    if(!d.connection?.domain)T("Tidak ada domain","error");
    else window.open(`https://${d.connection.domain}`,"_blank")
  };
  if(d.latitude&&d.longitude){
    const ok=await loadLeaflet();
    if(ok){
      const wrap=$("ipt-map-wrap");wrap.style.display="block";
      if(!map){
        map=L.map("ipt-map",{zoomControl:!0,attributionControl:!1}).setView([d.latitude,d.longitude],11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map)
      }else map.setView([d.latitude,d.longitude],11);
      if(marker)marker.remove();
      marker=L.marker([d.latitude,d.longitude],{draggable:!1}).addTo(map).bindPopup(`<b>${d.ip}</b><br>${d.city||""}, ${d.country||""}`).openPopup();
      setTimeout(()=>map.invalidateSize(),200)
    }
  }
}

function renderHist(){
  const el=$("ipt-hist");if(!el)return;
  if(!hist.length){el.innerHTML="";return}
  el.innerHTML=`<div class="ipt-hist-head"><span>🕐 Riwayat (${hist.length})</span><button class="ipt-clear" id="ipt-clrh">🗑</button></div>
  <div class="ipt-hist-list">${hist.map((h,i)=>`<div class="ipt-hist-item" data-ip="${h.ip}">
    <span class="ipt-hist-flag">${h.flag}</span>
    <span class="ipt-hist-ip">${h.ip}</span>
    <span class="ipt-hist-loc">${h.city||"?"}, ${h.country||"?"}</span>
  </div>`).join("")}</div>`;
  $("ipt-clrh").onclick=()=>{if(confirm("Hapus riwayat?")){hist=[];sh();renderHist()}};
  el.querySelectorAll(".ipt-hist-item").forEach(x=>x.onclick=()=>{$("ipt-input").value=x.dataset.ip;lookup(x.dataset.ip)})
}

function renderFav(){
  const el=$("ipt-fav-list");if(!el)return;
  if(!favs.length){el.innerHTML="";return}
  el.innerHTML=`<div class="ipt-fav-head">⭐ Favorit (${favs.length})</div>
  <div class="ipt-fav-grid">${favs.map(ip=>`<button class="ipt-fav-chip" data-ip="${ip}">${ip}</button>`).join("")}</div>`;
  el.querySelectorAll(".ipt-fav-chip").forEach(b=>b.onclick=()=>{$("ipt-input").value=b.dataset.ip;lookup(b.dataset.ip)})
}

function build(){
  if($("tool-iptrack"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="iptrack"]')){
    const b=document.createElement("button");b.dataset.tool="iptrack";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span> IP Tracker';
    const a=nav.querySelector('button[data-tool="ip"]');if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-iptrack")){
    const s=document.createElement("section");s.id="tool-iptrack";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🌍 IP Tracker + Map</h2><p>Geolokasi + bulk + riwayat + favorit · ipwho.is + Leaflet</p></div>
    <div class="ipt-tabs">
      <button class="ipt-tab active" data-tab="single">🔍 Single</button>
      <button class="ipt-tab" data-tab="bulk">📊 Bulk</button>
    </div>
    <div class="ipt-panel active" data-panel="single">
      <div class="row" style="align-items:stretch">
        <input type="text" id="ipt-input" placeholder="8.8.8.8 / domain" style="flex:1;margin:0">
        <button class="btn primary" id="ipt-btn">🔍 Lookup</button>
        <button class="btn" id="ipt-mine">📍 IP Saya</button>
      </div>
    </div>
    <div class="ipt-panel" data-panel="bulk">
      <textarea id="ipt-bulk" class="ipt-bulk-textarea" placeholder="Paste 1-10 IP, satu per baris atau pisah koma" rows="5"></textarea>
      <div class="row"><button class="btn primary" id="ipt-bulk-go">📊 Bulk Lookup</button></div>
    </div>
    <div id="ipt-map-wrap" class="ipt-map-wrap" style="display:none"><div id="ipt-map" class="ipt-map"></div></div>
    <div id="ipt-result" class="ipt-result"></div>
    <div id="ipt-fav-list" class="ipt-fav-list"></div>
    <div id="ipt-hist" class="ipt-hist"></div>`;
    ct.appendChild(s);
    s.querySelectorAll(".ipt-tab").forEach(t=>{
      t.onclick=()=>{
        s.querySelectorAll(".ipt-tab").forEach(x=>x.classList.remove("active"));
        s.querySelectorAll(".ipt-panel").forEach(x=>x.classList.remove("active"));
        t.classList.add("active");
        s.querySelector(`[data-panel="${t.dataset.tab}"]`).classList.add("active")
      }
    })
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.iptrack="IP Tracker";
  $("ipt-btn").onclick=()=>lookup($("ipt-input").value.trim());
  $("ipt-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("ipt-btn").click()});
  $("ipt-mine").onclick=()=>{ $("ipt-input").value="";lookup("")};
  $("ipt-bulk-go").onclick=()=>bulkLookup($("ipt-bulk").value);
  renderHist();renderFav()
}
if(window.registerTool)window.registerTool("iptrack",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));else setTimeout(build,900);
window.IPTracker={lookup,bulk:bulkLookup,favs:()=>favs,hist:()=>hist};
})();
