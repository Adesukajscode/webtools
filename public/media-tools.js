(function(){"use strict";
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),out=(id,h)=>{const e=$(id);if(e)e.innerHTML=h},toast=window.toast||(m=>console.log(m)),dl=(u,n)=>{const a=document.createElement("a");a.href=u;a.download=n;document.body.appendChild(a);a.click();a.remove()},loadImg=s=>new Promise((r,j)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>r(i);i.onerror=()=>j(Error("img"));i.src=s}),loadVid=s=>new Promise((r,j)=>{const v=document.createElement("video");v.muted=!0;v.playsInline=!0;v.preload="auto";v.onloadedmetadata=()=>r(v);v.onerror=()=>j(Error("vid"));v.src=s});

const WSRC=`self.onmessage=e=>{const{id,type,data,w,h,p}=e.data;const run=()=>{const d=data;if(type==="unsharp"){const o=new Uint8ClampedArray(d.length),k=p.amount;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;let r=0,g=0,b=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const j=((y+dy)*w+x+dx)*4;r+=d[j];g+=d[j+1];b+=d[j+2]}r/=9;g/=9;b/=9;o[i]=Math.max(0,Math.min(255,d[i]+(d[i]-r)*k));o[i+1]=Math.max(0,Math.min(255,d[i+1]+(d[i+1]-g)*k));o[i+2]=Math.max(0,Math.min(255,d[i+2]+(d[i+2]-b)*k));o[i+3]=d[i+3]}return{id,buffer:o.buffer}}if(type==="grade"){const{bright,contrast,sat,hue,sepia}=p,cH=Math.cos(hue),sH=Math.sin(hue);for(let i=0;i<d.length;i+=4){let r=d[i]*bright,g=d[i+1]*bright,b=d[i+2]*bright;r=(r-128)*contrast+128;g=(g-128)*contrast+128;b=(b-128)*contrast+128;const L=r*.299+g*.587+b*.114;r=L+(r-L)*sat;g=L+(g-L)*sat;b=L+(b-L)*sat;if(hue){const nr=r*cH-g*sH,ng=r*sH+g*cH;r=nr;g=ng}if(sepia>0){const sr=r*.393+g*.769+b*.189,sg=r*.349+g*.686+b*.168,sb=r*.272+g*.534+b*.131;r=r*(1-sepia)+sr*sepia;g=g*(1-sepia)+sg*sepia;b=b*(1-sepia)+sb*sepia}d[i]=Math.max(0,Math.min(255,r));d[i+1]=Math.max(0,Math.min(255,g));d[i+2]=Math.max(0,Math.min(255,b))}return{id,buffer:d.buffer}}};const r=run();self.postMessage(r,r.buffer?[r.buffer]:[])};`;
let wk=null,wid=0,pend=new Map();
const gWk=()=>{if(wk)return wk;wk=new Worker(URL.createObjectURL(new Blob([WSRC],{type:"application/javascript"})));wk.onmessage=e=>{const{id}=e.data;if(pend.has(id)){pend.get(id)(e.data);pend.delete(id)}};wk.onerror=e=>console.error("[w]",e);return wk};
const wTask=(type,d,w,h,p)=>new Promise((res,rej)=>{const id=++wid;pend.set(id,res);setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(Error("timeout"))}},15000);gWk().postMessage({id,type,data:d.buffer,w,h,p},[d.buffer])});

// UPSCALE
async function upscale(file,scale){
  const st=$("up-status"),res=$("up-result"),pv=$("up-preview");
  try{
    st.textContent="📂 Reading...";
    const u=URL.createObjectURL(file),img=await loadImg(u),W=img.naturalWidth,H=img.naturalHeight;
    pv.innerHTML=`<div class="mt-label">Original: <strong>${W}×${H}</strong> · ${(file.size/1024).toFixed(1)} KB</div><img src="${u}" class="mt-img">`;
    let TW=Math.floor(W*scale),TH=Math.floor(H*scale);const MX=8192;
    if(TW>MX||TH>MX){const r=Math.min(MX/TW,MX/TH);TW=Math.floor(TW*r);TH=Math.floor(TH*r)}
    st.textContent=`⚙️ ${W}×${H} → ${TW}×${TH}...`;
    let cur=document.createElement("canvas");cur.width=W;cur.height=H;cur.getContext("2d").drawImage(img,0,0);let cw=W,ch=H;
    while(cw*1.5<TW){const nw=Math.floor(cw*1.5),nh=Math.floor(ch*1.5),nc=document.createElement("canvas");nc.width=nw;nc.height=nh;const nctx=nc.getContext("2d");nctx.imageSmoothingEnabled=!0;nctx.imageSmoothingQuality="high";nctx.drawImage(cur,0,0,nw,nh);cur=nc;cw=nw;ch=nh}
    const oc=document.createElement("canvas");oc.width=TW;oc.height=TH;const octx=oc.getContext("2d",{willReadFrequently:!0});octx.imageSmoothingEnabled=!0;octx.imageSmoothingQuality="high";octx.drawImage(cur,0,0,TW,TH);
    st.textContent="⚙️ Sharpening...";
    const id=octx.getImageData(0,0,TW,TH),r=await wTask("unsharp",id.data,TW,TH,{amount:0.55});
    octx.putImageData(new ImageData(new Uint8ClampedArray(r.buffer),TW,TH),0,0);
    const jpg=oc.toDataURL("image/jpeg",0.95),png=oc.toDataURL("image/png"),kb=(jpg.length*0.75/1024).toFixed(0);
    res.innerHTML=`<div class="mt-result-head">✅ ${W}×${H} → ${TW}×${TH} (${scale}x)</div><img src="${jpg}" class="mt-img"><div class="mt-actions"><button class="btn primary" id="up-dlj">⬇ JPG</button><button class="btn" id="up-dlp">⬇ PNG</button></div><div class="mt-note">Progressive bicubic + WebWorker unsharp · ${kb} KB</div>`;
    $("up-dlj").onclick=()=>dl(jpg,"upscaled_"+Date.now()+".jpg");
    $("up-dlp").onclick=()=>dl(png,"upscaled_"+Date.now()+".png");
    st.textContent="✅ Done!"
  }catch(e){console.error(e);st.textContent="❌ "+e.message}
}

// COLOR GRADING
const PR={none:[1,1,1,0,0],cinematic:[1.15,.92,.95,-3,.15],vintage:[1.05,.88,1.08,5,.35],cyberpunk:[1.08,1.22,1.55,-18,0],cold:[1,1.02,1.12,178,0],warm:[1.12,1.05,1.28,-15,.18],noir:[.95,1.35,0,0,.05],vivid:[1.02,1.22,1.75,0,0],soft:[1.08,1.05,1.15,0,.08],retro:[1.05,1.08,1.4,-8,.28],y2k:[1.1,1.15,1.6,-25,.1],film:[.98,1.1,.95,0,.2]};
let cgi=null,cp="none",cbusy=!1;
const cgF=()=>{const p=PR[cp],g=(id,d=100)=>(+($(id)?.value)||0)/d;return{bright:p[0]+g("cg-bright"),contrast:p[1]+g("cg-contrast"),sat:p[2]+g("cg-sat"),hue:p[3]+(+($("cg-hue")?.value)||0),sepia:Math.max(0,Math.min(1,p[4]+g("cg-sepia"))),blur:g("cg-blur",10),vig:g("cg-brillo")}};
const cgA=()=>{const f=cgF(),c=`brightness(${f.bright}) contrast(${f.contrast}) saturate(${f.sat}) hue-rotate(${f.hue}deg) sepia(${f.sepia}) blur(${f.blur}px)`,i=$("cg-img");if(i)i.style.filter=c;const cd=$("cg-css");if(cd)cd.textContent="filter: "+c+";";if(f.vig>0&&i&&i.parentNode){let v=i.parentNode.querySelector(".mt-vignette");if(!v){v=document.createElement("div");v.className="mt-vignette";i.parentNode.appendChild(v)}v.style.opacity=f.vig}};
async function cgLoad(file){if(!file)return;try{const u=URL.createObjectURL(file);cgi=await loadImg(u);out("cg-preview",`<div class="mt-label">${cgi.naturalWidth}×${cgi.naturalHeight} · ${(file.size/1024).toFixed(1)} KB</div><div class="mt-img-wrap"><img id="cg-img" src="${u}" class="mt-img"></div>`);cgA();toast("Loaded","success")}catch(e){toast("Fail: "+e.message,"error")}}
async function cgSave(fmt){if(!cgi)return toast("Pick image first","error");if(cbusy)return;cbusy=!0;try{const W=cgi.naturalWidth,H=cgi.naturalHeight,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d",{willReadFrequently:!0});x.drawImage(cgi,0,0);const f=cgF(),im=x.getImageData(0,0,W,H),r=await wTask("grade",im.data,W,H,f);x.putImageData(new ImageData(new Uint8ClampedArray(r.buffer),W,H),0,0);const ex=fmt==="png"?"png":"jpeg",u=c.toDataURL("image/"+ex,0.95);dl(u,"graded_"+Date.now()+"."+(ex==="jpeg"?"jpg":"png"));toast("✅ Saved","success")}catch(e){toast("Err: "+e.message,"error")}finally{cbusy=!1}}

// STABILIZER
const seek=(v,t)=>new Promise(r=>{let d=!1;const f=()=>{if(d)return;d=!0;r()};v.onseeked=f;try{v.currentTime=Math.max(0,Math.min(t,(v.duration||t)-.05))}catch(e){}setTimeout(f,1200)});
const est=(a,b)=>{const w=a.width,h=a.height,R=8;let bx=0,by=0,bd=1/0;for(let dy=-R;dy<=R;dy+=2)for(let dx=-R;dx<=R;dx+=2){let d=0,n=0;for(let y=10;y<h-10;y+=4)for(let x=10;x<w-10;x+=4){const x2=x+dx,y2=y+dy;if(x2<0||x2>=w||y2<0||y2>=h)continue;const i1=(y*w+x)*4,i2=(y2*w+x2)*4;d+=Math.abs(a.data[i1]-b.data[i2])+Math.abs(a.data[i1+1]-b.data[i2+1])+Math.abs(a.data[i1+2]-b.data[i2+2]);n++}const av=n?d/n:1/0;if(av<bd){bd=av;bx=dx;by=dy}}return{dx:bx,dy:by}};
async function stabilize(file,str,sm,cr){
  const st=$("vs-status"),res=$("vs-result");
  try{
    st.textContent="📹 Loading...";
    const u=URL.createObjectURL(file),v=await loadVid(u),W=v.videoWidth,H=v.videoHeight,D=v.duration;
    if(!W||!H)throw Error("no metadata");
    const N=Math.min(30,Math.max(8,Math.floor(D))),SW=180,SH=Math.floor(SW*H/W),s=document.createElement("canvas");s.width=SW;s.height=SH;
    const sc=s.getContext("2d",{willReadFrequently:!0}),fr=[];
    for(let i=0;i<N;i++){await seek(v,(D/(N+1))*(i+1));sc.drawImage(v,0,0,SW,SH);fr.push(sc.getImageData(0,0,SW,SH));st.textContent=`⚙️ ${i+1}/${N}...`}
    const raw=[{dx:0,dy:0}];for(let i=1;i<N;i++)raw.push(est(fr[i-1],fr[i]));
    const win=Math.max(1,Math.floor(sm)),sm2=raw.map((_,i)=>{let sx=0,sy=0,c=0;for(let j=Math.max(0,i-win);j<=Math.min(raw.length-1,i+win);j++){sx+=raw[j].dx;sy+=raw[j].dy;c++}return{dx:sx/c,dy:sy/c}});
    await seek(v,D/2);
    const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d"),mid=sm2[Math.floor(sm2.length/2)],sx=W/SW,sy=H/SH,cp2=Math.floor(Math.min(W,H)*cr/100);
    const ox=-mid.dx*sx*str-cp2/2,oy=-mid.dy*sy*str-cp2/2;
    x.drawImage(v,Math.max(-cp2,Math.min(0,ox)),Math.max(-cp2,Math.min(0,oy)),W+cp2,H+cp2);
    const u2=c.toDataURL("image/jpeg",.92);let tm=0;raw.forEach(r=>tm+=Math.hypot(r.dx,r.dy));
    const avg=tm/raw.length,sd=Math.sqrt(raw.reduce((s,r)=>s+Math.pow(Math.hypot(r.dx,r.dy)-avg,2),0)/raw.length),stab=Math.max(0,100-Math.round(avg*5));
    res.innerHTML=`<div class="mt-result-head">✅ Preview stabilized</div><img src="${u2}" class="mt-img"><div class="mt-actions"><button class="btn primary" id="vs-dl">⬇ Frame</button></div><div class="mt-metrics"><div class="mt-metric"><span>Motion</span><b>${tm.toFixed(1)}</b></div><div class="mt-metric"><span>Avg/frame</span><b>${avg.toFixed(2)}</b></div><div class="mt-metric"><span>Std</span><b>${sd.toFixed(2)}</b></div><div class="mt-metric"><span>Stability</span><b>${stab}%</b></div><div class="mt-metric"><span>Offset</span><b>${mid.dx.toFixed(1)}, ${mid.dy.toFixed(1)}</b></div><div class="mt-metric"><span>Window</span><b>${win*2+1}</b></div></div><div class="mt-note">${N} frame · ${SW}×${SH} analysis</div>`;
    $("vs-dl").onclick=()=>dl(u2,"stab_"+Date.now()+".jpg");
    st.textContent=`✅ Stability ${stab}%`
  }catch(e){console.error(e);st.textContent="❌ "+e.message}
}

// UI
function build(){
  if($("tool-up"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  ["ai","stab","cg"].forEach(o=>{$("tool-"+o)?.remove();nav.querySelector(`button[data-tool="${o}"]`)?.remove()});
  const T=[
    {id:"up",title:"AI Upscale HD",ic:"🔍",h:`<div class="tool-head"><h2>🔍 AI Upscale HD</h2><p>Perbesar foto 2x-4x</p></div><div class="mt-notice">⚡ Progressive bicubic + WebWorker unsharp</div><input type="file" id="up-file" accept="image/*" style="display:none"><div class="row"><button class="btn primary" id="up-pick">🖼 Pilih Foto</button><select id="up-scale" class="mt-select"><option value="2">2x</option><option value="3">3x</option><option value="4">4x</option></select></div><div id="up-status" class="mt-status">Pilih foto</div><div id="up-preview" class="mt-preview"></div><div id="up-result" class="mt-result"></div>`},
    {id:"cg",title:"Color Grading",ic:"🎨",h:`<div class="tool-head"><h2>🎨 Color Grading</h2><p>12 preset sinematik</p></div><input type="file" id="cg-file" accept="image/*" style="display:none"><div class="row"><button class="btn primary" id="cg-pick">🖼 Pilih Foto</button></div><div class="cg-presets" id="cg-presets"></div><input type="hidden" id="cg-preset" value="none"><div class="cg-sliders">${[["bright","Brightness",-50,50,0,.1],["contrast","Contrast",-50,50,0,.1],["sat","Saturation",-50,50,0,.1],["hue","Hue",-180,180,0,1],["sepia","Sepia",0,100,0,.1],["blur","Blur",0,5,0,.1],["brillo","Vignette",0,100,0,.1]].map(([k,n,mn,mx,v,st])=>`<label>${n} <input type="range" id="cg-${k}" min="${mn}" max="${mx}" value="${v}" step="${st}"><span id="cg-${k}-v">${v}</span></label>`).join("")}</div><div class="row"><button class="btn primary" id="cg-dlj">⬇ JPG</button><button class="btn" id="cg-dlp">⬇ PNG</button><button class="btn" id="cg-reset">↺ Reset</button></div><div class="mt-css"><span>CSS:</span> <code id="cg-css">filter: none;</code></div><div id="cg-preview" class="mt-preview"></div>`},
    {id:"vs",title:"Video Stabilizer",ic:"📹",h:`<div class="tool-head"><h2>📹 Video Stabilizer</h2><p>Motion analysis multi-frame</p></div><div class="mt-notice">📹 Sample N frame · estimasi motion · rolling avg · stability score</div><input type="file" id="vs-file" accept="video/*" style="display:none"><div class="row"><button class="btn primary" id="vs-pick">🎬 Pilih Video</button></div><div class="vs-controls"><label>Strength <input type="range" id="vs-str" min="0" max="30" value="15"><span id="vs-str-v">15</span></label><label>Smoothness <input type="range" id="vs-sm" min="1" max="10" value="3"><span id="vs-sm-v">3</span></label><label>Crop <input type="range" id="vs-cr" min="0" max="30" value="8"><span id="vs-cr-v">8</span>%</label></div><div id="vs-status" class="mt-status">Pilih video</div><div id="vs-result" class="mt-result"></div>`}
  ];
  T.forEach(t=>{
    const b=document.createElement("button");b.dataset.tool=t.id;b.innerHTML=`<span class="nav-icon">${t.ic}</span> ${t.title}`;
    const a=nav.querySelector('button[data-tool="youtube"]')||nav.querySelector('button[data-tool="ga"]');
    if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b);
    const s=document.createElement("section");s.id="tool-"+t.id;s.className="tool";s.innerHTML=t.h;ct.appendChild(s);
    if(window.TOOL_TITLES)window.TOOL_TITLES[t.id]=t.title
  });
  const ps=$("cg-presets");if(ps)ps.innerHTML=Object.keys(PR).map(k=>`<button class="cg-p${k==="none"?" active":""}" data-p="${k}">${k}</button>`).join("");
  bind()
}
function bind(){
  $("up-pick").onclick=()=>$("up-file").click();
  $("up-file").onchange=e=>{const f=e.target.files[0];if(f)upscale(f,+$("up-scale").value)};
  $("cg-pick").onclick=()=>$("cg-file").click();
  $("cg-file").onchange=e=>{const f=e.target.files[0];if(f)cgLoad(f)};
  document.querySelectorAll(".cg-p").forEach(b=>{b.onclick=()=>{document.querySelectorAll(".cg-p").forEach(x=>x.classList.remove("active"));b.classList.add("active");cp=b.dataset.p;$("cg-preset").value=cp;cgA()}});
  ["bright","contrast","sat","hue","sepia","blur","brillo"].forEach(k=>{const el=$("cg-"+k);if(el)el.oninput=()=>{const v=$("cg-"+k+"-v");if(v)v.textContent=el.value;cgA()}});
  $("cg-dlj").onclick=()=>cgSave("jpg");
  $("cg-dlp").onclick=()=>cgSave("png");
  $("cg-reset").onclick=()=>{["bright","contrast","sat","hue","sepia","blur","brillo"].forEach(k=>{const el=$("cg-"+k);if(el){el.value=0;const v=$("cg-"+k+"-v");if(v)v.textContent="0"}});cp="none";document.querySelectorAll(".cg-p").forEach(x=>x.classList.toggle("active",x.dataset.p==="none"));cgA()};
  $("vs-pick").onclick=()=>$("vs-file").click();
  ["str","sm","cr"].forEach(k=>{const el=$("vs-"+k);if(el)el.oninput=()=>{const v=$("vs-"+k+"-v");if(v)v.textContent=el.value}});
  $("vs-file").onchange=e=>{const f=e.target.files[0];if(f)stabilize(f,+$("vs-str").value/10,+$("vs-sm").value,+$("vs-cr").value)};
}
function boot(){if(!document.getElementById("tool-hash"))return;build();if(typeof window.applyIcons==="function")window.applyIcons()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,850));else setTimeout(boot,850);
})();
