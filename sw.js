// Offline-Unterstützung: App-Dateien zwischenspeichern, immer zuerst das Netz fragen
const C="meisterstueck-v6";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["/","/index.html","/manifest.json","/icon-192.png"])));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
self.addEventListener("push",e=>{let m={title:"Meisterstück",body:"Zeit für deinen Schritt."};try{m=e.data.json()}catch(_){}
  e.waitUntil(self.registration.showNotification(m.title,{body:m.body,icon:"/icon-192.png",badge:"/icon-192.png"}))});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window"}).then(l=>l.length?l[0].focus():clients.openWindow("/")))});
