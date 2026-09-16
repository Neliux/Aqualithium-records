const CACHE='swim-quest-final-20260916-6';
const ASSETS=['./','./index.html','./manifest.webmanifest','./swim-quest-icon-192.png','./swim-quest-icon-512.png','./workout-clan-fix.js','./index(20260916-163437).html'];
const PEAR_FIX_CSS=`
/* Swim Quest: Pera adaptada a móvil */
.pear-scene{overflow-y:auto!important;overflow-x:hidden!important;align-items:flex-start!important;justify-content:flex-start!important;padding:14px 12px calc(110px + env(safe-area-inset-bottom))!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;overscroll-behavior-y:contain!important;}
.pear-stage{width:min(760px,100%)!important;min-height:0!important;height:auto!important;justify-content:flex-start!important;padding:16px 0 28px!important;}
.pear-topic-grid{padding-bottom:22px!important;}
.pear-scene .pear-shine{display:none!important;}
@media(max-width:560px){.pear-scene{padding-left:10px!important;padding-right:10px!important}.pear-stage{width:100%!important}.pear-text{font-size:16px!important;line-height:1.5!important;min-height:150px!important}.pear-next{min-height:50px!important}.pear-close{padding:8px 12px!important}}
`;
function patchPear(text){if(!text||!text.includes('<html'))return text;const tag='<style id="swimquest-pear-mobile-fix">'+PEAR_FIX_CSS+'</style>';if(text.includes('id="swimquest-pear-mobile-fix"'))return text;return text.replace('</head>',tag+'</head>');}
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith((async()=>{const url=new URL(e.request.url);
if(url.pathname.endsWith('/index.html')||url.pathname.endsWith('/')){try{const r=await fetch(e.request,{cache:'no-store'});const text=await r.text();const patched=text.replace('</body>','<script src="./workout-clan-fix.js?v=20260916"></script></body>');const response=new Response(patched,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});const c=await caches.open(CACHE);await c.put(e.request,response.clone());return response}catch(err){const cached=await caches.match(e.request);return cached||new Response('Swim Quest no disponible',{status:503})}}
if(url.pathname.endsWith('/index(20260916-163437).html')){try{const r=await fetch(e.request,{cache:'no-store'});const text=await r.text();const patched=patchPear(text);const response=new Response(patched,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});const c=await caches.open(CACHE);await c.put(e.request,response.clone());return response}catch(err){const cached=await caches.match(e.request);return cached||new Response('Swim Quest no disponible',{status:503})}}
const cached=await caches.match(e.request);if(cached)return cached;try{const r=await fetch(e.request);const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}catch(err){return cached}})()});
