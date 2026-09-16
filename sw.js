const CACHE='swim-quest-final-20260916-8';
const ASSETS=['./','./index.html','./manifest.webmanifest','./swim-quest-icon-192.png','./swim-quest-icon-512.png','./workout-clan-fix.js','./final-fixes.js','./index(20260916-163437).html'];
function patchGame(text){
  if(!text||!text.includes('<html'))return text;
  let out=text.replace('if(x.count>5){','if(x.count>25){');
  if(!out.includes('src="./final-fixes.js')){
    out=out.replace('</body>','<script src="./workout-clan-fix.js?v=20260916-8"></script><script src="./final-fixes.js?v=20260916-8"></script></body>');
  }
  return out;
}
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith((async()=>{const url=new URL(e.request.url);
if(url.pathname.endsWith('/index.html')||url.pathname.endsWith('/')){try{const r=await fetch(e.request,{cache:'no-store'});const text=await r.text();const patched=text.replace('</body>','<script src="./workout-clan-fix.js?v=20260916-8"></script></body>');const response=new Response(patched,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});const c=await caches.open(CACHE);await c.put(e.request,response.clone());return response}catch(err){const cached=await caches.match(e.request);return cached||new Response('Swim Quest no disponible',{status:503})}}
if(url.pathname.endsWith('/index(20260916-163437).html')){try{const r=await fetch(e.request,{cache:'no-store'});const text=await r.text();const patched=patchGame(text);const response=new Response(patched,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});const c=await caches.open(CACHE);await c.put(e.request,response.clone());return response}catch(err){const cached=await caches.match(e.request);return cached||new Response('Swim Quest no disponible',{status:503})}}
const cached=await caches.match(e.request);if(cached)return cached;try{const r=await fetch(e.request);const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}catch(err){return cached}})()});
