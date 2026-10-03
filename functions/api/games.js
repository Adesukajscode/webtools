const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const T=15000;
async function ft(u,o={},m=T){const c=new AbortController(),t=setTimeout(()=>c.abort(),m);try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}}
let CACHE={list:null,ts:0,ttl:1000*60*60*6};

const FB=[
  {id:"vex10",title:"Vex 10",cat:"platformer",thumb:"https://img.gamedistribution.com/57820e917cff42488d174341b8866760-512x384.jpg",url:"https://html5.gamedistribution.com/57820e917cff42488d174341b8866760/"},
  {id:"moto-x3m",title:"Moto X3M",cat:"racing",thumb:"",url:"https://html5.gamedistribution.com/motox3m/"},
  {id:"tunnel-rush",title:"Tunnel Rush",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/tunnelrush/"},
  {id:"slope",title:"Slope",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/slope/"},
  {id:"retro-bowl",title:"Retro Bowl",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/retrobowl/"},
  {id:"1v1-lol",title:"1v1.LOL",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/1v1lol/"},
  {id:"crossy-road",title:"Crossy Road",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/crossyroad/"},
  {id:"subway-surfers",title:"Subway Surfers",cat:"runner",thumb:"",url:"https://html5.gamedistribution.com/subwaysurfers/"},
  {id:"cut-rope",title:"Cut the Rope",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/cuttherope/"},
  {id:"2048",title:"2048",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/2048/"},
  {id:"tetris",title:"Tetris",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/tetris/"},
  {id:"hextris",title:"Hextris",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/hextris/"},
  {id:"dino",title:"Dino Run",cat:"runner",thumb:"",url:"https://html5.gamedistribution.com/dinorun/"},
  {id:"flappy",title:"Flappy Bird",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/flappybird/"},
  {id:"snake",title:"Snake",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/snake/"},
  {id:"pacman",title:"Pacman",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/pacman/"},
  {id:"fruit-ninja",title:"Fruit Ninja",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/fruitninja/"},
  {id:"angry-birds",title:"Angry Birds",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/angrybirds/"},
  {id:"temple",title:"Temple Run",cat:"runner",thumb:"",url:"https://html5.gamedistribution.com/templerun/"},
  {id:"candy",title:"Candy Crush",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/candycrush/"},
  {id:"hill-climb",title:"Hill Climb",cat:"racing",thumb:"",url:"https://html5.gamedistribution.com/hillclimb/"},
  {id:"drift",title:"Drift Hunters",cat:"racing",thumb:"",url:"https://html5.gamedistribution.com/drifthunters/"},
  {id:"among-us",title:"Among Us",cat:"multiplayer",thumb:"",url:"https://html5.gamedistribution.com/amongus/"},
  {id:"basketball",title:"Basketball Stars",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/basketballstars/"},
  {id:"soccer",title:"Soccer Skills",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/soccerskills/"},
  {id:"8ball",title:"8 Ball Pool",cat:"sports",thumb:"",url:"https://html5.gamedistribution.com/8ballpool/"},
  {id:"chess",title:"Chess",cat:"board",thumb:"",url:"https://html5.gamedistribution.com/chess/"},
  {id:"checkers",title:"Checkers",cat:"board",thumb:"",url:"https://html5.gamedistribution.com/checkers/"},
  {id:"solitaire",title:"Solitaire",cat:"card",thumb:"",url:"https://html5.gamedistribution.com/solitaire/"},
  {id:"mahjong",title:"Mahjong",cat:"board",thumb:"",url:"https://html5.gamedistribution.com/mahjong/"},
  {id:"sudoku",title:"Sudoku",cat:"puzzle",thumb:"",url:"https://html5.gamedistribution.com/sudoku/"},
  {id:"slice",title:"Slice Master",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/slicemaster/"},
  {id:"stack",title:"Stack Tower",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/stacktower/"},
  {id:"traffic",title:"Traffic Run",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/trafficrun/"},
  {id:"paper-io",title:"Paper.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/paperio/"},
  {id:"slither",title:"Slither.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/slitherio/"},
  {id:"agar",title:"Agar.io",cat:"arcade",thumb:"",url:"https://html5.gamedistribution.com/agario/"},
  {id:"krunker",title:"Krunker.io",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/krunker/"},
  {id:"surviv",title:"Surviv.io",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/survivio/"},
  {id:"diep",title:"Diep.io",cat:"shooter",thumb:"",url:"https://html5.gamedistribution.com/diepio/"}
].map(g=>({...g,provider:"fallback"}));

async function gmFeed(){
  const pages=[1,2,3,4];
  const all=[];
  const results=await Promise.all(pages.map(p=>
    ft(`https://gamemonetize.com/rssfeed.php?format=json&type=all&category=all&amount=200&page=${p}`,{headers:{"User-Agent":UA,"Accept":"application/json"}})
      .then(r=>r.ok?r.json():[]).catch(()=>[])
  ));
  for(const d of results){
    const arr=Array.isArray(d)?d:(d.games||d.data||d.items||[]);
    for(const g of arr){
      if(!g.title||!g.id)continue;
      all.push({
        id:"gm-"+g.id,
        title:g.title||g.name,
        cat:(g.category||g.categoryName||"game").toString().toLowerCase().split(",")[0].trim().slice(0,25),
        thumb:g.thumb||g.thumbnail||g.image||"",
        url:g.url||g.embed||`https://html5.gamemonetize.com/${g.id}/`,
        provider:"gamemonetize"
      })
    }
  }
  return all
}

async function getGames(){
  if(CACHE.list&&Date.now()-CACHE.ts<CACHE.ttl)return{list:CACHE.list,source:"cache"+(CACHE.list.length?"("+CACHE.list.length+")":"")};
  const errors=[];
  try{
    const list=await gmFeed();
    if(list.length>50){CACHE.list=list;CACHE.ts=Date.now();return{list,source:"gamemonetize("+list.length+")"}}
    errors.push("gm returned "+list.length)
  }catch(e){errors.push("gm: "+e.message)}
  // fallback
  CACHE.list=FB;CACHE.ts=Date.now();
  return{list:FB,source:"fallback("+FB.length+")",errors}
}

export async function onRequest(context){
  const{request}=context;
  const u=new URL(request.url);
  const q=(u.searchParams.get("q")||"").toLowerCase().trim();
  const cat=(u.searchParams.get("cat")||"").toLowerCase().trim();
  const page=Math.max(1,parseInt(u.searchParams.get("page"))||1);
  const per=Math.min(parseInt(u.searchParams.get("per"))||60,120);
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"public, max-age=1800"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  try{
    const{list,source,errors}=await getGames();
    let filtered=list;
    if(q)filtered=filtered.filter(g=>g.title.toLowerCase().includes(q)||g.cat.includes(q));
    if(cat&&cat!=="all")filtered=filtered.filter(g=>g.cat.includes(cat));
    const total=filtered.length;
    const start=(page-1)*per;
    const pageItems=filtered.slice(start,start+per);
    return new Response(JSON.stringify({
      ok:!0,total,page,per,
      hasMore:start+per<total,
      source,errors:errors||null,
      categories:[...new Set(list.map(g=>g.cat))].filter(Boolean).sort().slice(0,30),
      games:pageItems
    }),{status:200,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200)}),{status:500,headers})
  }
}
