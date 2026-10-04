(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=window.toast||(m=>console.log(m));
const API="https://text.pollinations.ai/openai";
const MODEL="openai";
const SYS=`Kamu NEXA, asisten AI ramah untuk website CyberToolbox. Website ini punya 30+ tools: downloader (TikTok/YouTube/IG/FB/Spotify/APK), media (AI Upscale, Color Grading, Video Stabilizer), AI/CV (Face Recognition, Hand Tracking), game (Game Arcade, Slot, YouTube Player, Wikipedia), utility (Hash, JWT, QR, Password, dll).
Bisa jawab pertanyaan APAPUN. Jawab SINGKAT (maks 4 paragraf), ramah, dalam Bahasa Indonesia. Pakai emoji seperlunya.`;

const ROBOT_SVG=`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ab1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#06b6d4"/></linearGradient><linearGradient id="ab2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a2e"/><stop offset="1" stop-color="#1e3a5f"/></linearGradient><radialGradient id="ab3"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient></defs><g class="ab-float"><line x1="50" y1="14" x2="50" y2="22" stroke="#5a6e5a" stroke-width="1.5" stroke-linecap="round"/><circle class="ab-ant" cx="50" cy="12" r="3.5" fill="#3b82f6"/><circle class="ab-glow" cx="50" cy="12" r="6" fill="url(#ab3)"/><rect x="26" y="22" width="48" height="38" rx="14" fill="#e8f2ff" stroke="#8ab5d4" stroke-width="1.5"/><rect x="32" y="30" width="36" height="22" rx="10" fill="url(#ab2)"/><g class="ab-eye" style="transform-origin:41px 41px"><circle cx="41" cy="41" r="4" fill="#3b82f6"/><circle cx="41" cy="41" r="2" fill="#bfdbfe"/></g><g class="ab-eye" style="transform-origin:59px 41px"><circle cx="59" cy="41" r="4" fill="#3b82f6"/><circle cx="59" cy="41" r="2" fill="#bfdbfe"/></g><rect class="ab-mouth" x="44" y="55" width="12" height="2" rx="1" fill="#8ab5d4" style="transform-origin:50px 56px"/><rect x="30" y="64" width="40" height="26" rx="10" fill="url(#ab1)" stroke="#8ab5d4" stroke-width="1.5"/><rect x="40" y="70" width="20" height="10" rx="4" fill="#0a1a2e"/><circle class="ab-glow" cx="45" cy="75" r="2" fill="#22c55e"/><circle cx="50" cy="75" r="2" fill="#f59e0b"/><circle cx="55" cy="75" r="2" fill="#a78bfa"/><rect x="36" y="90" width="10" height="4" rx="2" fill="#8ab5d4"/><rect x="54" y="90" width="10" height="4" rx="2" fill="#8ab5d4"/></g></svg>`;

let panel=null,fab=null,busy=!1,bound=!1;
let history=[];
try{history=JSON.parse(localStorage.getItem("ct_ai_chat")||"[]")}catch(e){history=[]}
const saveH=()=>{try{localStorage.setItem("ct_ai_chat",JSON.stringify(history.slice(-40)))}catch(e){}};

// ═══ FORMAT ═══
function fmt(t){
  let h=esc(t);
  h=h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  h=h.replace(/\*(.+?)\*/g,"<em>$1</em>");
  h=h.replace(/`([^`]+)`/g,"<code>$1</code>");
  h=h.replace(/```([\s\S]*?)```/g,"<pre>$1</pre>");
  h=h.replace(/^[\-\*] (.+)$/gm,"<li>$1</li>");
  h=h.replace(/(<li>[\s\S]*?<\/li>)/g,"<ul>$1</ul>");
  h=h.replace(/^\d+\. (.+)$/gm,"<li>$1</li>");
  h=h.replace(/\n/g,"<br>");
  return h;
}
const scroll=()=>{const e=$("ab-msgs");if(e)e.scrollTop=e.scrollHeight};
const addMsg=(role,text)=>{const e=$("ab-msgs");if(!e)return null;const d=document.createElement("div");d.className="ab-msg "+role;d.innerHTML=fmt(text);e.appendChild(d);scroll();return d};

function setState(s){
  const av=document.querySelector(".ab-avatar");
  if(av){av.classList.remove("ab-think","ab-talk","ab-happy");if(s!=="idle")av.classList.add("ab-"+s)}
  const st=document.querySelector(".ab-status");
  if(st){const t={idle:"Online · tanya apa saja",think:"Berpikir...",talk:"Menjawab...",happy:"Selesai"}[s]||"Online";st.textContent=t}
}

// ═══ STREAM CHAT via Pollinations ═══
async function askAI(userMsg){
  const msgs=[{role:"system",content:SYS},...history.slice(-10).map(m=>({role:m.role,content:m.content})),{role:"user",content:userMsg}];
  const r=await fetch(API,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:MODEL,messages:msgs,stream:!1,private:!0})
  });
  if(!r.ok)throw Error("AI HTTP "+r.status);
  const d=await r.json();
  const reply=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
  if(!reply)throw Error("AI tidak mengirim respons");
  return reply.trim();
}

// ═══ SEND ═══
async function send(){
  if(busy)return;
  const inp=$("ab-input");
  const txt=(inp?.value||"").trim();
  if(!txt)return;
  inp.value="";inp.style.height="auto";
  busy=!0;
  const btn=$("ab-send");if(btn)btn.disabled=!0;
  history.push({role:"user",content:txt});
  addMsg("user",txt);
  setState("think");
  const typing=document.createElement("div");
  typing.className="ab-typing";typing.id="ab-typing";
  typing.innerHTML="<span></span><span></span><span></span>";
  $("ab-msgs").appendChild(typing);scroll();
  try{
    const ans=await askAI(txt);
    $("ab-typing")?.remove();
    setState("talk");
    const el=addMsg("bot","");
    // Typewriter
    const words=ans.split(/(\s+)/);let acc="";
    for(let i=0;i<words.length;i++){
      acc+=words[i];el.innerHTML=fmt(acc);scroll();
      if(i%4===0)await new Promise(r=>setTimeout(r,18))
    }
    el.innerHTML=fmt(ans);scroll();
    history.push({role:"assistant",content:ans});
    saveH();
    setState("happy");
    setTimeout(()=>setState("idle"),1500)
  }catch(e){
    $("ab-typing")?.remove();
    addMsg("bot","❌ "+e.message+"\n\nCoba lagi beberapa detik lagi.");
    setState("idle")
  }finally{
    busy=!1;if(btn)btn.disabled=!1;inp?.focus()
  }
}

// ═══ CLEAR ═══
function clearChat(){
  if(!confirm("Hapus semua percakapan?"))return;
  history=[];saveH();
  const e=$("ab-msgs");
  if(e)e.innerHTML="";
  addMsg("bot","Halo! Aku **NEXA** 🤖 — tanya apa saja, aku bisa bantu.\n\nContoh: \"jelaskan cara download TikTok\", \"apa itu JWT\", \"buat puisi pendek\" 👇")
}

// ═══ BUILD ═══
function build(){
  if(panel)return;
  fab=document.createElement("button");
  fab.className="ab-fab";fab.id="ab-fab";fab.title="Tanya NEXA";
  fab.innerHTML=ROBOT_SVG;
  document.body.appendChild(fab);

  panel=document.createElement("div");
  panel.className="ab-panel";panel.id="ab-panel";
  panel.innerHTML=`
    <div class="ab-head">
      <div class="ab-avatar" id="ab-avatar">${ROBOT_SVG}</div>
      <div class="ab-info">
        <h4>NEXA <span class="ab-badge">AI</span></h4>
        <div class="ab-status">Online · tanya apa saja</div>
      </div>
      <button class="ab-btn" id="ab-clear" title="Hapus chat">🗑</button>
      <button class="ab-btn" id="ab-close" title="Tutup">✕</button>
    </div>
    <div class="ab-msgs" id="ab-msgs"></div>
    <div class="ab-sugg" id="ab-sugg"></div>
    <div class="ab-input-row">
      <textarea class="ab-input" id="ab-input" placeholder="Tanya apa saja..." rows="1"></textarea>
      <button class="ab-send" id="ab-send" title="Kirim">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>`;
  document.body.appendChild(panel);

  $("ab-close").addEventListener("click",close);
  $("ab-clear").addEventListener("click",clearChat);
  $("ab-send").addEventListener("click",send);
  const inp=$("ab-input");
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
  inp.addEventListener("input",()=>{inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,120)+"px"});

  renderSugg();
  // Restore history
  if(history.length){
    history.forEach(m=>addMsg(m.role==="user"?"user":"bot",m.content));
    setTimeout(scroll,100)
  }else{
    addMsg("bot","Halo! Aku **NEXA** 🤖 — tanya apa saja, aku bisa bantu.\n\nContoh: \"jelaskan cara download TikTok\", \"apa itu JWT\", \"buat puisi pendek\" 👇")
  }
}

function renderSugg(){
  const el=$("ab-sugg");if(!el)return;
  const s=["Apa itu JWT?","Cara download TikTok","Jelaskan AI Upscale","Buat puisi pendek","Tips belajar coding","Cara pakai Game Arcade"];
  el.innerHTML=s.map(x=>`<button class="ab-sugg-btn">${esc(x)}</button>`).join("");
  el.querySelectorAll(".ab-sugg-btn").forEach(b=>b.addEventListener("click",()=>{
    const i=$("ab-input");if(i){i.value=b.textContent;send()}
  }))
}

function open(){if(!panel)build();panel.classList.add("ab-show");fab.classList.add("ab-hide");setTimeout(()=>$("ab-input")?.focus(),200)}
function close(){panel?.classList.remove("ab-show");fab?.classList.remove("ab-hide")}
function toggle(){panel?.classList.contains("ab-show")?close():open()}

function boot(){build();fab.addEventListener("click",toggle)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,1300));
else setTimeout(boot,1300);

window.NEXA={open,close,toggle,send,clear:clearChat,history:()=>history};
})();
