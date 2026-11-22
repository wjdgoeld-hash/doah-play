/* Doah Play v0.4 - offline, cache-first static assets; network-first navigation. */
const CACHE='doah-play-v04-20261121';
const ASSETS=[
 './','./index.html','./app.js','./style.css','./manifest.webmanifest',
 './icon.svg','./icon-180.png','./icon-192.png','./icon-512.png',
 './pororo-snow.jpg','./pororo-picnic.jpg','./pororo-ocean.jpg',
 ...Array.from({length:8},(_,i)=>`./story-art-${i+1}.webp`), './wolf-peek.webp',
 ...Array.from({length:8},(_,i)=>`./narration-${String(i+1).padStart(2,'0')}.mp3`),
 './gentle-piano-medley.mp3',
 ...Array.from({length:8},(_,i)=>`./story-${i+1}.mp3`)
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 // Browsers request MP3 with Range: network fallback when online; avoid caching partial responses.
 const isNavigation=request.mode==='navigate';
 // Safari and Chromium may ask for MP3 byte ranges. Serve slices from the full cached file.
 const range=request.headers.get('Range');
 if(range&&new URL(request.url).pathname.endsWith('.mp3')){
   event.respondWith(caches.match(request,{ignoreSearch:true}).then(async cached=>{
     if(!cached)return fetch(request);
     const buffer=await cached.arrayBuffer();
     const match=/bytes=(\d+)-(\d*)/.exec(range);
     if(!match)return cached;
     const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),buffer.byteLength-1):buffer.byteLength-1;
     if(start>=buffer.byteLength||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${buffer.byteLength}`}});
     return new Response(buffer.slice(start,end+1),{status:206,headers:{
       'Content-Type':'audio/mpeg','Accept-Ranges':'bytes',
       'Content-Range':`bytes ${start}-${end}/${buffer.byteLength}`,
       'Content-Length':String(end-start+1)
     }});
   }));return;
 }

 if(isNavigation){event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
   return response;
 }).catch(()=>caches.match('./index.html')));return;}
 event.respondWith(caches.match(request,{ignoreSearch:true}).then(hit=>hit||fetch(request).then(response=>{
   if(response.ok&&response.type==='basic'&&!request.headers.has('Range')){
     const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));
   }
   return response;
 })));
});
