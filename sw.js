const CACHE='swim-quest-final-20260922-27';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './swim-quest-icon-192.png',
  './swim-quest-icon-512.png',
  './workout-clan-fix.js',
  './final-fixes.js',
  './index(20260916-163437).html'
];

function patchGame(text){
  if(!text||!text.includes('<html'))return text;
  let out=text.replace('if(x.count>5){','if(x.count>25){');
  if(!out.includes('src="./final-fixes.js')){
    out=out.replace(
      '</body>',
      '<script src="./workout-clan-fix.js?v=20260917-1"></script><script id="swq-sw-final-fixes" src="./final-fixes.js?v=20260922-27"></script></body>'
    );
  }
  return out;
}

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  event.respondWith((async()=>{
    const url=new URL(event.request.url);

    if(url.pathname.endsWith('/index.html')||url.pathname.endsWith('/')){
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        const text=await response.text();
        const patched=text.replace(
          '</body>',
          '<script src="./workout-clan-fix.js?v=20260917-1"></script></body>'
        );
        const result=new Response(patched,{
          status:response.status,
          statusText:response.statusText,
          headers:{
            'Content-Type':'text/html; charset=utf-8',
            'Cache-Control':'no-store'
          }
        });
        const cache=await caches.open(CACHE);
        await cache.put(event.request,result.clone());
        return result;
      }catch(err){
        const cached=await caches.match(event.request);
        return cached||new Response('Swim Quest no disponible',{status:503});
      }
    }

    if(url.pathname.endsWith('/index(20260916-163437).html')){
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        const text=await response.text();
        const patched=patchGame(text);
        const result=new Response(patched,{
          status:response.status,
          statusText:response.statusText,
          headers:{
            'Content-Type':'text/html; charset=utf-8',
            'Cache-Control':'no-store'
          }
        });
        const cache=await caches.open(CACHE);
        await cache.put(event.request,result.clone());
        return result;
      }catch(err){
        const cached=await caches.match(event.request);
        return cached||new Response('Swim Quest no disponible',{status:503});
      }
    }

    const cached=await caches.match(event.request);
    if(cached)return cached;

    try{
      const response=await fetch(event.request);
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      return response;
    }catch(err){
      return cached||new Response('Swim Quest no disponible',{status:503});
    }
  })());
});
