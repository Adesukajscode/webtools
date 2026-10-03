const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const T=20000;
async function ft(u,o={},m=T){const c=new AbortController(),t=setTimeout(()=>c.abort(),m);try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}}

let CACHE={list:null,ts:0,ttl:1000*60*60*6}; // 6 jam

// ═══ FETCH GAMEMONETIZE (multi-page) ═══
async function fetchGM(){
  const all=[];
  // 5 page paralel = ~1000 game
  const pages=[1,2,3,4,5];
  const results=await Promise.all(pages.map(p=>
    ft(`https://gamemonetize.com/rssfeed.php?format=json&type=all&category=all&amount=200&page=${p}`,{headers:{"User-Agent":UA,"Accept":"application/json"}})
      .then(r=>r.ok?r.json():[]).catch(()=>[])
  ));
  for(const d of results){
    const arr=Array.isArray(d)?d:(d.games||d.data||d.items||[]);
    for(const g of arr){
      all.push({
        id:g.id||g.guid||"gm-"+Math.random().toString(36).slice(2,10),
        title:g.title||g.name||"Untitled",
        cat:(g.category||g.categoryName||g.tags||"game").toString().toLowerCase().split(",")[0].trim().slice(0,25),
        thumb:g.thumb||g.thumbnail||g.image||g.banner||"",
        url:g.url||g.embed||`https://html5.gamemonetize.com/${g.id}/`,
        desc:(g.description||"").slice(0,120),
        provider:"gamemonetize"
      })
    }
  }
  return all.filter(g=>g.title&&g.url)
}

// ═══ FETCH IDEV.GAMES ═══
async function fetchIDev(){
  try{
    const r=await ft("https://idev.games/api/games?limit=500&order=popular",{headers:{"User-Agent":UA,"Accept":"application/json"}});
    if(!r.ok)return[];
    const d=await r.json();
    const arr=Array.isArray(d)?d:(d.games||d.data||[]);
    return arr.map(g=>({
      id:g.slug||g.id||"idev-"+Math.random().toString(36).slice(2,10),
      title:g.title||g.name||"Untitled",
      cat:(g.category||"game").toString().toLowerCase().slice(0,25),
      thumb:g.thumbnail||g.image||g.thumb||"",
      url:`https://idev.games/embed/${g.slug||g.id}`,
      desc:(g.description||"").slice(0,120),
      provider:"idev"
    })).filter(g=>g.title&&g.url)
  }catch(e){return[]}
}

// ═══ FALLBACK LIST (diperluas) ═══
const FALLBACK=[
  {id:"vex-10",title:"Vex 10",cat:"platformer",thumb:"https://img.gamedistribution.com/57820e917cff42488d174341b8866760-512x384.jpg",url:"https://html5.gamedistribution.com/57820e917cff42488d174341b8866760/"},
  {id:"vex-9",title:"Vex 9",cat:"platformer",thumb:"",url:"https://html5.gamedistribution.com/vex9/"},
  {id:"vex-8",title:"Vex 8",cat:"platformer",thumb:"",url:"https://html5.gamedistribution.com/vex8/"},
  {id:"vex-7",title:"Vex 7",cat:"platformer",thumb:"",url:"https://html5.gamedistribution.com/vex7/"},
  {id:"vex-6",title:"Vex 6",cat:"platformer",thumb:"",url:"https://html5.gamedistribution.com/vex6/"},
  {id:"bubble-shooter",title:"Bubble Shooter",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/bubbleshooter/"},
  {id:"moto-x3m",title:"Moto X3M",cat:"racing",thumb:"",url:"https://html5.gamedistribution.com/motox3m/"},
  {id:"tunnel-rush",title:"Tunnel Rush",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/tunnelrush/"},
  {id:"slope",title:"Slope",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/slope/"},
  {id:"retro-bowl",title:"Retro Bowl",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/retrobowl/"},
  {id:"1v1-lol",title:"1v1.LOL",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/1v1lol/"},
  {id:"crossy-road",title:"Crossy Road",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/crossyroad/"},
  {id:"subway-surfers",title:"Subway Surfers",cat:"runner",thumb:"",url:"https://html5.gamedistribution.com/subwaysurfers/"},
  {id:"cut-the-rope",title:"Cut the Rope",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/cuttherope/"},
  {id:"2048",title:"2048",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/2048/"},
  {id:"tetris",title:"Tetris",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/tetris/"},
  {id:"hextris",title:"Hextris",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/hextris/"},
  {id:"dino-run",title:"Dino Run",cat:"runner",thumb:"",url:"https://html5.gamedistribution.com/dinorun/"},
  {id:"flappy-bird",title:"Flappy Bird",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/flappybird/"},
  {id:"snake",title:"Snake",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/snake/"},
  {id:"pacman",title:"Pacman",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/pacman/"},
  {id:"space-invaders",title:"Space Invaders",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/spaceinvaders/"},
  {id:"fruit-ninja",title:"Fruit Ninja",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/fruitninja/"},
  {id:"angry-birds",title:"Angry Birds",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/angrybirds/"},
  {id:"temple-run",title:"Temple Run",cat:"runner",thumb:"",url:"https://html5.gamedistribution.com/templerun/"},
  {id:"candy-crush",title:"Candy Crush",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/candycrush/"},
  {id:"hill-climb",title:"Hill Climb Racing",cat:"racing",thumb:"",url:"https://html5.gamedistribution.com/hillclimb/"},
  {id:"drift-hunters",title:"Drift Hunters",cat:"racing",thumb:"",url:"https://html5.gamedistribution.com/drifthunters/"},
  {id:"among-us",title:"Among Us",cat:"multiplayer",thumb:"",url:"https://html5.gamedistribution.com/amongus/"},
  {id:"basketball-stars",title:"Basketball Stars",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/basketballstars/"},
  {id:"soccer-skills",title:"Soccer Skills",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/soccerskills/"},
  {id:"8-ball-pool",title:"8 Ball Pool",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/8ballpool/"},
  {id:"chess",title:"Chess",cat:"board",thumb:"",url:"https://html5.gamedistribution.com/chess/"},
  {id:"checkers",title:"Checkers",cat:"board",thumb:"",url:"https://html5.gamedistribution.com/checkers/"},
  {id:"solitaire",title:"Solitaire",cat:"card",thumb:"",url:"https://html5.gamedistribution.com/solitaire/"},
  {id:"mahjong",title:"Mahjong",cat:"board",thumb:"",url:"https://html5.gamedistribution.com/mahjong/"},
  {id:"sudoku",title:"Sudoku",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/sudoku/"},
  {id:"word-search",title:"Word Search",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/wordsearch/"},
  {id:"bubble-shooter-fruits",title:"Bubble Shooter Fruits",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/bdf565c63e5a4702a32838fd2405adf1/"},
  {id:"slice-master",title:"Slice Master",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/slicemaster/"},
  {id:"stack-tower",title:"Stack Tower",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/stacktower/"},
  {id:"wood-blocks",title:"Wood Blocks",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/woodblocks/"},
  {id:"traffic-run",title:"Traffic Run",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/trafficrun/"},
  {id:"paper-io",title:"Paper.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/paperio/"},
  {id:"slither-io",title:"Slither.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/slitherio/"},
  {id:"agar-io",title:"Agar.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/agario/"},
  {id:"krunker",title:"Krunker.io",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/krunker/"},
  {id:"surviv-io",title:"Surviv.io",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/survivio/"},
  {id:"mope-io",title:"Mope.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/mopeio/"},
  {id:"diep-io",title:"Diep.io",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/diepio/"},
];

async function getGames(){
  if(CACHE.list&&Date.now()-CACHE.ts<CACHE.ttl)return{list:CACHE.list,source:"cache"};
  const errors=[];
  // GM utama (1000+ game)
  try{
    const list=await fetchGM();
    if(list.length>50){
      CACHE.list=list;CACHE.ts=Date.now();
      return{list,source:"gamemonetize("+list.length+")"}
    }
  }catch(e){errors.push("gm:"+e.message)}
  // iDev fallback
  try{
    const list=await fetchIDev();
    if(list.length){
      CACHE.list=list;CACHE.ts=Date.now();
      return{list,source:"idev("+list.length+")"}
    }
  }catch(e){errors.push("idev:"+e.message)}
  // Hardcoded fallback
  return{list:FALLBACK,source:"fallback("+FALLBACK.length+")",errors}
}

export async function onRequest(context){
  const{request}=context;
  const u=new URL(request.url);
  const q=(u.searchParams.get("q")||"").toLowerCase().trim();
  const cat=(u.searchParams.get("cat")||"").toLowerCase().trim();
  const page=Math.max(1,parseInt(u.searchParams.get("page"))||1);
  const perPage=Math.min(parseInt(u.searchParams.get("per"))||60,120);
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"public, max-age=3600"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  try{
    const{list,source,errors}=await getGames();
    let filtered=list;
    if(q)filtered=filtered.filter(g=>g.title.toLowerCase().includes(q)||g.cat.includes(q));
    if(cat&&cat!=="all")filtered=filtered.filter(g=>g.cat.includes(cat));
    const total=filtered.length;
    const start=(page-1)*perPage;
    const pageItems=filtered.slice(start,start+perPage);
    return new Response(JSON.stringify({
      ok:!0,
      total,
      page,
      perPage,
      hasMore:start+perPage<total,
      source,
      errors:errors||null,
      categories:[...new Set(list.map(g=>g.cat))].filter(Boolean).sort().slice(0,30),
      games:pageItems
    }),{status:200,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200)}),{status:500,headers})
  }
}
