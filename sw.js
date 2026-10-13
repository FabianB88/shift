const CACHE='shift-2026-10-13-8';
const ASSETS=['./','./index.html','./style.css','./app.js','./engine.js','./audio.js','./duels.js','./multiplayer-ui.js','./data.js','./manifest.webmanifest','./icon.svg','./logo.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('cirkelstrijd-')||k.startsWith('shift-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(new URL(event.request.url).pathname.includes('/api/'))return;
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
