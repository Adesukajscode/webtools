(function(){"use strict";
const $=id=>document.getElementById(id),T=window.toast||(m=>console.log(m));
let lastColors=[],lastUrl="";

function medianCut(px,k){
  let bx=[px];
  while(bx.length<k){
    let bi=-1,br=-1,bax=0;
    bx.forEach((b,i)=>{if(b.length<2)return;
      const ch=[[],[],[]];b.forEach(p=>{ch[0].push(p[0]);ch[1].push(p[1]);ch[2].push(p[2])});
      const rg=ch.map(a=>Math.max(...a)-Math.min(...a));const mi=rg.indexOf(Math.max(...rg));
      if(rg[mi]>br){br=rg[mi];bi=i;bax=mi}});
    if(bi<0)break;
    const b=bx[bi];b.sort((a,c)=>a[bax]-c[bax]);
    const mid=b.length>>1;bx.splice(bi,1,b.slice(0,mid),b.slice(mid))
  }
  return bx.map(b=>{const avg=[0,0,0];b.forEach(p=>{avg[0]+=p[0];avg[1]+=p[1];avg[2]+=p[2]});return avg.map(v=>Math.round(v/b.length))})
}
const toHex=c=>"#"+c.map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
function hexToRgb(h){h=h.replace("#","");if(h.length===3)h=h.split("").map(x=>x+x).join("");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function rgbToHsl([r,g,b]){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);h*=60}return[Math.round(h),Math.round(s*100),Math.round(l*100)]}
function hslToRgb([h,s,l]){h/=360;s/=100;l/=100;let r,g,b;if(s===0){r=g=b=l}else{const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};const q=l<.5?l*(1+s):l+s-l*s;const p=2*l-q;r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3)}return[Math.round(r*255),Math.round(g*255),Math.round(b*255)]}
const luma=c=>(c[0]*299+c[1]*587+c[2]*114)/1000;
const isLight=c=>luma(c)>140;

function harmony(hsl){
  const[h,s,l]=hsl;
  const wrap=x=>(x%360+360)%360;
  return{
    complementary:[[wrap(h+180),s,l]],
    analogous:[[wrap(h-30),s,l],[wrap(h+30),s,l]],
    triadic:[[wrap(h+120),s,l],[wrap(h+240),s,l]],
    split:[[wrap(h+150),s,l],[wrap(h+210),s,l]],
    tetradic:[[wrap(h+90),s,l],[wrap(h+180),s,l],[wrap(h+270),s,l]],
    monochromatic:[[h,Math.max(0,s-30),Math.max(20,l-15)],[h,s,Math.min(90,l+15)]]
  }
}

function extract(img){
  const c=document.createElement("canvas");
  const maxW=240;
  const sc=Math.min(1,maxW/img.naturalWidth);
  c.width=Math.floor(img.naturalWidth*sc);c.height=Math.floor(img.naturalHeight*sc);
  const cx=c.getContext("2d",{willReadFrequently:!0});
  cx.drawImage(img,0,0,c.width,c.height);
  const d=cx.getImageData(0,0,c.width,c.height).data;
  const px=[];
  for(let i=0;i<d.length;i+=16){
    const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
    if(a<200)continue;
    const l=(r+g+b)/3;
    if(l>250||l<8)continue;
    px.push([r,g,b])
  }
  if(px.length<20)return null;
  return medianCut(px,6)
}

function render(colors){
  const el=$("pal-result");if(!el)return;
  el.innerHTML=`<div class="pal-grid">${colors.map((c,i)=>{
    const hex=toHex(c),hsl=rgbToHsl(c),lt=isLight(c);
    return`<div class="pal-card" style="background:${hex};color:${lt?'#000':'#fff'}" data-hex="${hex}">
      <div class="pal-idx">#${i+1}</div>
      <div class="pal-hex">${hex}</div>
      <div class="pal-hsl">hsl(${hsl[0]},${hsl[1]}%,${hsl[2]}%)</div>
      <div class="pal-copy">📋</div></div>`
  }).join("")}</div>
  <div class="pal-harmony">
    <div class="pal-harm-title">🎨 Harmony Palette</div>
    ${colors.slice(0,2).map((c,i)=>{
      const hsl=rgbToHsl(c);
      const h=harmony(hsl);
      return`<div class="pal-harm-group">
        <div class="pal-harm-base" style="background:${toHex(c)}">Base ${toHex(c)}</div>
        ${Object.entries(h).map(([name,arr])=>`
          <div class="pal-harm-row"><span class="pal-harm-name">${name}</span>${arr.map(x=>{
            const rgb=hslToRgb(x);
            return`<span class="pal-harm-chip" style="background:${toHex(rgb)}" data-hex="${toHex(rgb)}" title="${toHex(rgb)}"></span>`
          }).join("")}</div>`).join("")}
      </div>`
    }).join("")}
  </div>
  <div class="pal-actions">
    <button class="btn primary" id="pal-copyall">📋 Copy CSS</button>
    <button class="btn" id="pal-json">📄 Export JSON</button>
    <button class="btn" id="pal-ase">🎨 Export ASE</button>
    <button class="btn" id="pal-grad">🌈 Gradient</button>
  </div>
  <div id="pal-gradient" class="pal-gradient"></div>`;

  el.querySelectorAll(".pal-card,.pal-harm-chip").forEach(card=>{
    card.onclick=()=>{
      const h=card.dataset.hex;
      if(navigator.clipboard)navigator.clipboard.writeText(h).then(()=>T(h+" dicopy","success"))
    }
  });
  $("pal-copyall").onclick=()=>{
    const css=":root {\n"+colors.map((c,i)=>`  --color-${i+1}: ${toHex(c)};`).join("\n")+"\n}";
    if(navigator.clipboard)navigator.clipboard.writeText(css).then(()=>T("CSS dicopy","success"))
  };
  $("pal-json").onclick=()=>{
    const data={colors:colors.map(c=>({hex:toHex(c),rgb:c,hsl:rgbToHsl(c)})),timestamp:Date.now()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="palette.json";a.click();
    T("JSON diunduh","success")
  };
  $("pal-ase").onclick=()=>{
    // Adobe Swatch Exchange (ASE) format
    const buf=[];
    const str=s=>{const b=new TextEncoder().encode(s);return b};
    const u32=n=>new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
    const u16=n=>new Uint8Array([(n>>>8)&255,n&255]);
    const f32=n=>{const b=new ArrayBuffer(4);new DataView(b).setFloat32(0,n);return new Uint8Array(b)};
    const push=x=>x.forEach(v=>buf.push(v));
    push(str("ASEF"));
    push(u16(1));push(u16(0));
    push(u32(colors.length));
    colors.forEach(c=>{
      const name="Color-"+toHex(c);
      push(u16(1)); // block type: color
      const blockData=[];
      pushBlock(push,name,c);
    });
    function pushBlock(push,name,c){
      const payload=[];
      const nameBytes=str(name);
      push(u16(nameBytes.length+1));
      nameBytes.forEach(b=>payload.push(b));
      payload.push(0);
      payload.push(0x52);payload.push(0x47);payload.push(0x42);payload.push(0x20); // RGB
      [c[0]/255,c[1]/255,c[2]/255].forEach(v=>{
        const b=new ArrayBuffer(4);new DataView(b).setFloat32(0,v);
        new Uint8Array(b).forEach(x=>payload.push(x))
      });
      payload.push(0);payload.push(0);
      push(u32(payload.length));
      payload.forEach(v=>push(new Uint8Array([v])))
    }
    const blob=new Blob([new Uint8Array(buf)],{type:"application/octet-stream"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="palette.ase";a.click();
    T("ASE diunduh (Photoshop/Illustrator)","success")
  };
  $("pal-grad").onclick=()=>{
    const grad=colors.map(c=>toHex(c)).join(", ");
    const cssLinear=`linear-gradient(90deg, ${grad})`;
    const cssRadial=`radial-gradient(circle, ${grad})`;
    $("pal-gradient").innerHTML=`
      <div class="pal-grad-box" style="background:${cssLinear}"></div>
      <div class="pal-grad-box" style="background:${cssRadial}"></div>
      <div class="pal-grad-code">linear: ${cssLinear}</div>
      <div class="pal-grad-code">radial: ${cssRadial}</div>
      <button class="btn" id="pal-grad-copy">📋 Copy CSS Gradient</button>`;
    $("pal-grad-copy").onclick=()=>{
      const css=`background: ${cssLinear};\nbackground: ${cssRadial};`;
      if(navigator.clipboard)navigator.clipboard.writeText(css).then(()=>T("Gradient CSS dicopy","success"))
    }
  }
}

async function handleFile(file){
  if(!file)return;
  try{
    const url=URL.createObjectURL(file);lastUrl=url;
    const img=await new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=url});
    $("pal-preview").innerHTML=`<img src="${url}" class="pal-img">`;
    const colors=extract(img);
    if(!colors)return T("Tidak bisa extract","error");
    lastColors=colors;render(colors);
    T("✅ "+colors.length+" warna terdeteksi","success")
  }catch(e){T("Error: "+e.message,"error")}
}

function build(){
  if($("tool-palette"))return;
  const nav=$("nav"),ct=document.querySelector(".content");if(!nav||!ct)return;
  if(!nav.querySelector('button[data-tool="palette"]')){
    const b=document.createElement("button");b.dataset.tool="palette";
    b.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="10" cy="19" r="2.5"/></svg></span> Palette';
    const a=nav.querySelector('button[data-tool="color"]');if(a&&a.nextSibling)nav.insertBefore(b,a.nextSibling);else nav.appendChild(b)
  }
  if(!$("tool-palette")){
    const s=document.createElement("section");s.id="tool-palette";s.className="tool";
    s.innerHTML=`<div class="tool-head"><h2>🎨 Palette Generator</h2><p>Median-cut extraction + harmony + gradient + export ASE/JSON</p></div>
    <input type="file" id="pal-file" accept="image/*" style="display:none">
    <div class="row"><button class="btn primary" id="pal-pick">🖼 Pilih Foto</button></div>
    <div id="pal-preview" class="pal-preview"></div>
    <div id="pal-result" class="pal-result"></div>`;
    ct.appendChild(s)
  }
  if(window.TOOL_TITLES)window.TOOL_TITLES.palette="Palette Generator";
  $("pal-pick").onclick=()=>$("pal-file").click();
  $("pal-file").onchange=e=>handleFile(e.target.files[0])
}
if(window.registerTool)window.registerTool("palette",()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(build,900));else setTimeout(build,900);
window.Palette={extract:()=>lastColors,clear:()=>{$("pal-preview").innerHTML="";$("pal-result").innerHTML=""}};
})();
