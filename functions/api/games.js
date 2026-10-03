const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const T=15000;
async function ft(u,o={},m=T){const c=new AbortController(),t=setTimeout(()=>c.abort(),m);try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}}

// ═══ CACHE IN-MEMORY (Worker warm) ═══
let CACHE={list:null,ts:0,ttl:1000*60*30}; // 30 menit

// ═══ FALLBACK LIST (kalau feed down) ═══
const FALLBACK=[
  {id:"vex-10",title:"Vex 10",cat:"platform",thumb:"https://img.gamedistribution.com/57820e917cff42488d174341b8866760-512x384.jpg",url:"https://html5.gamedistribution.com/57820e917cff42488d174341b8866760/"},
  {id:"bubble-shooter-fruits",title:"Bubble Shooter Fruits",cat:"puzzle",thumb:"https://img.gamedistribution.com/bdf565c63e5a4702a32838fd2405adf1-512x384.jpg",url:"https://html5.gamedistribution.com/bdf565c63e5a4702a32838fd2405adf1/"},
  {id:"moto-x3m",title:"Moto X3M",cat:"racing",thumb:"https://img.gamedistribution.com/8e1b1d6c5f9e4d3e8d3a1e5c9b6f4a2d-512x384.jpg",url:"https://html5.gamedistribution.com/motox3m/"},
  {id:"tunnel-rush",title:"Tunnel Rush",cat:"arcade",thumb:"https://img.gamedistribution.com/3a2b4c5d6e7f8a9b0c1d2e3f4a5b6c7d-512x384.jpg",url:"https://html5.gamedistribution.com/tunnelrush/"},
  {id:"slope",title:"Slope",cat:"arcade",thumb:"https://img.gamedistribution.com/4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e-512x384.jpg",url:"https://html5.gamedistribution.com/slope/"},
  {id:"retro-bowl",title:"Retro Bowl",cat:"sports",thumb:"https://img.gamedistribution.com/5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f-512x384.jpg",url:"https://html5.gamedistribution.com/retrobowl/"},
  {id:"1v1-lol",title:"1v1.LOL",cat:"shooter",thumb:"https://img.gamedistribution.com/6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a-512x384.jpg",url:"https://html5.gamedistribution.com/1v1lol/"},
  {id:"among-us-online",title:"Among Us",cat:"multiplayer",thumb:"https://img.gamedistribution.com/7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b-512x384.jpg",url:"https://html5.gamedistribution.com/amongus/"},
  {id:"crossy-road",title:"Crossy Road",cat:"arcade",thumb:"https://img.gamedistribution.com/8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c-512x384.jpg",url:"https://html5.gamedistribution.com/crossyroad/"},
  {id:"subway-surfers",title:"Subway Surfers",cat:"runner",thumb:"https://img.gamedistribution.com/9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d-512x384.jpg",url:"https://html5.gamedistribution.com/subwaysurfers/"},
  {id:"cut-the-rope",title:"Cut the Rope",cat:"puzzle",thumb:"https://img.gamedistribution.com/0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e-512x384.jpg",url:"https://html5.gamedistribution.com/cuttherope/"},
  {id:"2048",title:"2048",cat:"puzzle",thumb:"https://img.gamedistribution.com/1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f-512x384.jpg",url:"https://html5.gamedistribution.com/2048/"},
  {id:"tetris",title:"Tetris",cat:"puzzle",thumb:"https://img.gamedistribution.com/2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a-512x384.jpg",url:"https://html5.gamedistribution.com/tetris/"},
  {id:"hextris",title:"Hextris",cat:"puzzle",thumb:"https://img.gamedistribution.com/3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b-512x384.jpg",url:"https://html5.gamedistribution.com/hextris/"},
  {id:"dino-run",title:"Dino Run",cat:"arcade",thumb:"https://img.gamedistribution.com/4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c-512x384.jpg",url:"https://html5.gamedistribution.com/dinorun/"},
];

// ═══ FETCH GAMEMONETIZE FEED ═══
async function fetchGMFood(){
  // GameMonetize JSON feed — gratis, no auth
  const url="https://gamemonetize.com/rssfeed.php?format=json&type=all&category=all&amount=200&page=1";
  const r=await ft(url,{headers:{"User-Agent":UA,"Accept":"application/json"}});
  if(!r.ok)throw new Error("gm HTTP "+r.status);
  const d=await r.json();
  const arr=Array.isArray(d)?d:(d.games||d.data||d.items||[]);
  return arr.map(g=>({
    id:g.id||g.guid||g.slug||("gm-"+Math.random().toString(36).slice(2,8)),
    title:g.title||g.name||"Untitled",
    cat:(g.category||g.categoryName||g.tags||"game").toString().toLowerCase().slice(0,30),
    thumb:g.thumb||g.thumbnail||g.image||g.banner||"",
    url:g.url||g.embed||g.gameUrl||`https://html5.gamemonetize.com/${g.id}/`,
    desc:(g.description||"").slice(0,120),
    provider:"gamemonetize"
  })).filter(g=>g.title&&g.url)
}

// ═══ FETCH IDEV FEED (fallback) ═══
async function fetchIDev(){
  const r=await ft("https://idev.games/api/games?limit=200&order=popular",{headers:{"User-Agent":UA,"Accept":"application/json"}});
  if(!r.ok)throw new Error("idev HTTP "+r.status);
  const d=await r.json();
  const arr=Array.isArray(d)?d:(d.games||d.data||[]);
  return arr.map(g=>({
    id:g.slug||g.id||"idev-"+Math.random().toString(36).slice(2,8),
    title:g.title||g.name||"Untitled",
    cat:(g.category||"game").toString().toLowerCase().slice(0,30),
    thumb:g.thumbnail||g.image||g.thumb||"",
    url:`https://idev.games/embed/${g.slug||g.id}`,
    desc:(g.description||"").slice(0,120),
    provider:"idev"
  })).filter(g=>g.title&&g.url)
}

async function getGames(){
  if(CACHE.list&&Date.now()-CACHE.ts<CACHE.ttl)return{list:CACHE.list,source:"cache"};
  const errors=[];
  try{
    const list=await fetchGMFood();
    if(list.length){CACHE.list=list;CACHE.ts=Date.now();return{list,source:"gamemonetize"}}
  }catch(e){errors.push("gm:"+e.message)}
  try{
    const list=await fetchIDev();
    if(list.length){CACHE.list=list;CACHE.ts=Date.now();return{list,source:"idev"}}
  }catch(e){errors.push("idev:"+e.message)}
  // fallback hardcoded
  return{list:FALLBACK,source:"fallback",errors}
}

export async function onRequest(context){
  const{request}=context;
  const u=new URL(request.url);
  const q=(u.searchParams.get("q")||"").toLowerCase().trim();
  const cat=(u.searchParams.get("cat")||"").toLowerCase().trim();
  const limit=Math.min(parseInt(u.searchParams.get("limit"))||100,200);
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"public, max-age=1800"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  try{
    const{list,source,errors}=await getGames();
    let filtered=list;
    if(q)filtered=filtered.filter(g=>g.title.toLowerCase().includes(q)||g.cat.includes(q));
    if(cat&&cat!=="all")filtered=filtered.filter(g=>g.cat.includes(cat));
    filtered=filtered.slice(0,limit);
    return new Response(JSON.stringify({
      ok:!0,
      total:filtered.length,
      source,
      errors:errors||null,
      categories:[...new Set(list.map(g=>g.cat))].slice(0,20),
      games:filtered
    }),{status:200,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200)}),{status:500,headers})
  }
}
