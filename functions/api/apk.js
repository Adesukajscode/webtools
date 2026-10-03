const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const T=15000;
async function ft(u,o={},m=T){const c=new AbortController(),t=setTimeout(()=>c.abort(),m);try{return await fetch(u,{...o,signal:c.signal})}finally{clearTimeout(t)}}
function extractPackage(input){
  if(!input)return null;
  try{const u=new URL(input);const pkg=u.searchParams.get("id");if(pkg&&/^[a-zA-Z][a-zA-Z0-9_.]{1,100}$/.test(pkg))return pkg}catch(e){}
  if(/^[a-zA-Z][a-zA-Z0-9_.]{1,100}$/.test(input)&&input.includes("."))return input;
  return null}
async function fetchMetadata(pkg){
  const url=`https://api.pureapk.com/m/v3/cms/app_version?hl=en-US&package_name=${encodeURIComponent(pkg)}`;
  const r=await ft(url,{headers:{"User-Agent":UA,"Accept":"application/json"}});
  if(!r.ok)throw new Error(`APKPure API HTTP ${r.status}`);
  const d=await r.json();
  if(!d||!d.data||!d.data.length)throw new Error("Package tidak ditemukan di APKPure");
  const a=d.data[0];
  return{
    package:pkg,
    name:a.name||a.title||pkg,
    version:a.version_name||a.version||"latest",
    versionCode:a.version_code||0,
    icon:a.icon||"",
    size:a.size||0,
    minAndroid:a.required_os_version||a.min_sdk||"",
    updated:a.release_date||a.update_date||"",
    developer:a.developer||"",
    whatsNew:(a.change_log||a.whats_new||"").slice(0,300),
    downloads:a.download_count||"",
    apk:{label:"APK (universal)",type:"APK",url:`https://d.apkpure.com/b/APK/${pkg}?version=latest`},
    xapk:{label:"XAPK (bundle + OBB)",type:"XAPK",url:`https://d.apkpure.com/b/XAPK/${pkg}?version=latest`}
  }}
export async function onRequest(context){
  const{request}=context;
  const u=new URL(request.url);
  const input=u.searchParams.get("url")||u.searchParams.get("package")||"";
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-cache"};
  if(request.method==="OPTIONS")return new Response("",{status:200,headers});
  if(!input)return new Response(JSON.stringify({ok:!1,error:"missing 'url' atau 'package'"}),{status:400,headers});
  const pkg=extractPackage(input);
  if(!pkg)return new Response(JSON.stringify({ok:!1,error:"Package name tidak ditemukan. Contoh: com.whatsapp atau URL Play Store"}),{status:400,headers});
  try{
    const meta=await fetchMetadata(pkg);
    return new Response(JSON.stringify({ok:!0,...meta}),{status:200,headers})
  }catch(e){
    return new Response(JSON.stringify({ok:!1,error:String(e.message||e).slice(0,200),package:pkg,fallback:{note:"Metadata gagal, tapi link download tetap tersedia:",apk:`https://d.apkpure.com/b/APK/${pkg}?version=latest`,xapk:`https://d.apkpure.com/b/XAPK/${pkg}?version=latest`}}),{status:502,headers})
  }}
