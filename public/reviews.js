(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));
const MODERATOR="adeanantafahmi@gmail.com";
// ⚠️ GANTI kalau sudah daftar di web3forms.com (gratis, no signup flow ribet)
// Kalau kosong → pakai fallback mailto
const WEB3FORMS_KEY="13f34596-6827-4f1f-a10d-07449d3005fd";
const STORAGE_KEY="ct_reviews";
const ADMIN_KEY="ct_is_admin";

// ═══ ADMIN DETECTION ═══
function getLoggedUser(){
  try{
    const raw=localStorage.getItem("ct_auth");
    if(!raw)return null;
    const s=JSON.parse(raw);
    if(s.expire&&s.expire<Date.now())return null;
    return s.user||null;
  }catch(e){return null}
}
function isAdmin(){
  const u=getLoggedUser();
  if(!u||!u.email)return false;
  return u.email.toLowerCase()===MODERATOR.toLowerCase();
}
function checkAdminState(){
  const adm=isAdmin();
  if(adm)localStorage.setItem(ADMIN_KEY,"1");
  else localStorage.removeItem(ADMIN_KEY);
  return adm;
}

// ═══ STORAGE ═══
function loadReviews(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}
  catch(e){return[]}
}
function saveReviews(list){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(list))}
  catch(e){toast("Storage penuh","error")}
}

// ═══ KIRIM KE MODERATOR ═══
async function notifyModerator(review){
  const text=[
    "⭐ REVIEW BARU dari CyberToolbox",
    "",
    "Dari: "+review.name,
    "Email: "+(review.email||"(tidak diisi)"),
    "Rating: "+"★".repeat(review.rating)+"☆".repeat(5-review.rating),
    "",
    "Pesan:",
    review.text,
    "",
    "Waktu: "+new Date(review.ts).toLocaleString("id-ID"),
    "Device: "+review.device,
    "ID: "+review.id
  ].join("\n");

  // Provider 1: Web3Forms (kalau key diisi)
  if(WEB3FORMS_KEY){
    try{
      const r=await fetch("https://api.web3forms.com/submit",{
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({
          access_key:WEB3FORMS_KEY,
          to:MODERATOR,
          subject:"⭐ Review Baru - CyberToolbox ("+review.rating+"/5)",
          from_name:"CyberToolbox Review",
          name:review.name,
          email:review.email||"noreply@cybertoolbox.dev",
          message:text,
          rating:review.rating+" bintang"
        })
      });
      const d=await r.json();
      if(d.success)return{ok:true,method:"web3forms"}
    }catch(e){console.warn("[review] web3forms failed:",e)}
  }

  // Fallback: mailto
  const subject=encodeURIComponent("⭐ Review Baru - CyberToolbox");
  const body=encodeURIComponent(text);
  const mailto=`mailto:${MODERATOR}?subject=${subject}&body=${body}`;
  return{ok:true,method:"mailto",mailto}
}

// ═══ SUBMIT ═══
async function submitReview(data){
  const user=getLoggedUser();
  const review={
    id:"rv_"+Date.now()+"_"+Math.random().toString(36).slice(2,8),
    name:data.name||(user&&user.name)||"Anonim",
    email:data.email||(user&&user.email)||"",
    rating:data.rating,
    text:data.text,
    ts:Date.now(),
    device:navigator.userAgent.slice(0,80),
    pinned:false,
    admin:isAdmin()
  };
  const list=loadReviews();
  list.unshift(review);
  saveReviews(list);

  // kirim ke moderator
  const res=await notifyModerator(review);
  return{review,notify:res}
}

// ═══ RENDER ═══
function stars(n,interactive){
  let h='<div class="rv-stars'+(interactive?" rv-interactive":"")+'">';
  for(let i=1;i<=5;i++){
    h+=`<button class="rv-star ${i<=n?"on":""}" data-star="${i}" ${interactive?"":"disabled"}>★</button>`;
  }
  return h+"</div>"
}

function formatDate(ts){
  const d=new Date(ts);
  const now=new Date();
  const diff=Math.floor((now-d)/1000);
  if(diff<60)return"baru saja";
  if(diff<3600)return Math.floor(diff/60)+" mnt lalu";
  if(diff<86400)return Math.floor(diff/3600)+" jam lalu";
  if(diff<604800)return Math.floor(diff/86400)+" hari lalu";
  return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})
}

function renderList(){
  const list=loadReviews();
  const el=$("rv-list");
  if(!el)return;
  if(!list.length){
    el.innerHTML='<div class="rv-empty"><div class="rv-empty-icon">💬</div><div>Belum ada ulasan. Jadi yang pertama!</div></div>';
    return;
  }
  // sort: pinned dulu, lalu terbaru
  const sorted=[...list].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.ts-a.ts);
  const adm=isAdmin();
  el.innerHTML=sorted.map(r=>{
    const initial=esc((r.name||"A")[0].toUpperCase());
    return`<div class="rv-item ${r.pinned?"rv-pinned":""}" data-id="${r.id}">
      <div class="rv-head">
        <div class="rv-avatar">${initial}</div>
        <div class="rv-meta">
          <div class="rv-name">${esc(r.name)} ${r.admin?'<span class="rv-badge-admin">ADMIN</span>':''} ${r.pinned?'<span class="rv-badge-pin">📌</span>':''}</div>
          <div class="rv-date">${formatDate(r.ts)}</div>
        </div>
        ${stars(r.rating,false)}
      </div>
      <div class="rv-text">${esc(r.text)}</div>
      ${adm?`<div class="rv-admin-actions">
        <button class="rv-btn" data-action="pin" data-id="${r.id}">${r.pinned?"📌 Unpin":"📌 Pin"}</button>
        <button class="rv-btn rv-btn-del" data-action="del" data-id="${r.id}">🗑 Hapus</button>
      </div>`:''}
    </div>`
  }).join("")
}

// ═══ BUILD UI ═══
function build(){
  if($("rv-section"))return;
  const user=getLoggedUser();
  const adm=isAdmin();
  const sec=document.createElement("section");
  sec.id="rv-section";
  sec.className="rv-section";
  sec.innerHTML=`
    <div class="rv-header">
      <div class="rv-header-left">
        <div class="rv-title">⭐ Ulasan Pengunjung</div>
        <div class="rv-subtitle">Ceritakan pengalaman Anda pakai CyberToolbox</div>
      </div>
      <div class="rv-header-right">
        ${adm?'<div class="rv-admin-badge">🛡 ADMIN MODE</div>':''}
      </div>
    </div>

    <div class="rv-stats" id="rv-stats"></div>

    <form class="rv-form" id="rv-form">
      <div class="rv-form-row">
        <input type="text" id="rv-name" placeholder="Nama Anda" value="${user?esc(user.name||""):""}" ${user&&user.name?"readonly":""} maxlength="40" required>
        <input type="email" id="rv-email" placeholder="Email (opsional, tidak dipublikasikan)" value="${user?esc(user.email||""):""}" ${user&&user.email?"readonly":""} maxlength="80">
      </div>
      <div class="rv-form-label">Rating Anda:</div>
      <div id="rv-rating-wrap">${stars(0,true)}</div>
      <textarea id="rv-text" placeholder="Tulis ulasan Anda... (min. 10 karakter)" maxlength="500" required></textarea>
      <div class="rv-form-footer">
        <span class="rv-charcount" id="rv-charcount">0/500</span>
        <button type="submit" class="btn primary" id="rv-submit">📤 Kirim Ulasan</button>
      </div>
    </form>

    <div class="rv-list" id="rv-list"></div>
  `;
  const ct=document.querySelector(".content");
  if(ct){
    const anchor=ct.querySelector("#tool-apk")||ct.querySelector("#tool-dl")||ct.lastElementChild;
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(sec,anchor.nextSibling);
    else ct.appendChild(sec);
  }
  bindForm();
  bindList();
  updateStats();
  renderList();
}

// ═══ BIND FORM ═══
function bindForm(){
  const form=$("rv-form");
  if(!form)return;
  let selectedRating=0;

  // rating stars
  form.querySelectorAll(".rv-star").forEach(b=>{
    b.addEventListener("mouseenter",()=>{
      const v=+b.dataset.star;
      form.querySelectorAll(".rv-star").forEach(x=>x.classList.toggle("on",+x.dataset.star<=v))
    });
    b.addEventListener("click",()=>{
      selectedRating=+b.dataset.star;
      form.querySelectorAll(".rv-star").forEach(x=>x.classList.toggle("on",+x.dataset.star<=selectedRating))
    })
  });
  form.querySelector(".rv-stars").addEventListener("mouseleave",()=>{
    form.querySelectorAll(".rv-star").forEach(x=>x.classList.toggle("on",+x.dataset.star<=selectedRating))
  });

  // charcount
  const ta=$("rv-text"),cc=$("rv-charcount");
  if(ta&&cc)ta.addEventListener("input",()=>{cc.textContent=ta.value.length+"/500"});

  // submit
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const name=$("rv-name").value.trim();
    const email=$("rv-email").value.trim();
    const text=ta.value.trim();
    if(!name)return toast("Isi nama dulu","error");
    if(selectedRating<1)return toast("Pilih rating dulu","error");
    if(text.length<10)return toast("Ulasan minimal 10 karakter","error");

    const btn=$("rv-submit");
    btn.disabled=!0;btn.textContent="📤 Mengirim...";
    try{
      const{notify}=await submitReview({name,email,rating:selectedRating,text});
      // reset form
      ta.value="";cc.textContent="0/500";
      selectedRating=0;form.querySelectorAll(".rv-star").forEach(x=>x.classList.remove("on"));
      renderList();updateStats();
      if(notify.method==="mailto"&&notify.mailto){
        toast("Ulasan tersimpan! Buka email untuk notif moderator","success");
        setTimeout(()=>{window.location.href=notify.mailto},800)
      }else{
        toast("✅ Terima kasih atas ulasan Anda!","success")
      }
    }catch(err){
      toast("Gagal kirim: "+err.message,"error")
    }finally{
      btn.disabled=!1;btn.textContent="📤 Kirim Ulasan"
    }
  })
}

// ═══ BIND LIST (admin actions) ═══
function bindList(){
  const el=$("rv-list");
  if(!el)return;
  el.addEventListener("click",e=>{
    const b=e.target.closest("[data-action]");
    if(!b)return;
    if(!isAdmin())return toast("Hanya admin yang bisa","error");
    const id=b.dataset.id,act=b.dataset.action;
    let list=loadReviews();
    if(act==="del"){
      if(!confirm("Hapus ulasan ini?"))return;
      list=list.filter(r=>r.id!==id);
      saveReviews(list);renderList();updateStats();
      toast("Ulasan dihapus","success")
    }else if(act==="pin"){
      list=list.map(r=>r.id===id?{...r,pinned:!r.pinned}:r);
      saveReviews(list);renderList();
      toast("Status pin diubah","success")
    }
  })
}

// ═══ STATS ═══
function updateStats(){
  const el=$("rv-stats");
  if(!el)return;
  const list=loadReviews();
  if(!list.length){el.innerHTML="";return}
  const avg=(list.reduce((s,r)=>s+r.rating,0)/list.length).toFixed(1);
  const dist=[5,4,3,2,1].map(n=>{
    const c=list.filter(r=>r.rating===n).length;
    const p=list.length?Math.round(c/list.length*100):0;
    return`<div class="rv-dist-row"><span class="rv-dist-num">${n}★</span><div class="rv-dist-bar"><div class="rv-dist-fill" style="width:${p}%"></div></div><span class="rv-dist-cnt">${c}</span></div>`
  }).join("");
  el.innerHTML=`
    <div class="rv-stats-left">
      <div class="rv-avg">${avg}</div>
      <div class="rv-avg-stars">${"★".repeat(Math.round(avg))}${"☆".repeat(5-Math.round(avg))}</div>
      <div class="rv-avg-count">${list.length} ulasan</div>
    </div>
    <div class="rv-stats-right">${dist}</div>
  `
}

// ═══ ADMIN BADGE GLOBAL ═══
function showAdminBadge(){
  if(!isAdmin())return;
  if($("admin-float"))return;
  const b=document.createElement("div");
  b.id="admin-float";
  b.className="admin-float";
  b.innerHTML='🛡 <span>ADMIN</span>';
  b.title="Login sebagai: "+getLoggedUser().email;
  document.body.appendChild(b);
}

// ═══ BOOT ═══
function boot(){
  build();
  checkAdminState();
  showAdminBadge();
  window.Reviews={
    list:loadReviews,
    isAdmin,
    user:getLoggedUser,
    moderator:MODERATOR,
    clear:()=>{localStorage.removeItem(STORAGE_KEY);renderList();updateStats()}
  }
  // re-check admin setiap 3 detik (kalau user baru login)
  setInterval(()=>{showAdminBadge()},3000)
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,500));else setTimeout(boot,500);
})();
