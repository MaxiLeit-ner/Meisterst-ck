// Offline-Unterstützung: App-Dateien zwischenspeichern, immer zuerst das Netz fragen
const C="meisterstueck-v11";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["/","/index.html","/manifest.json","/icon-192.png"])));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
self.addEventListener("push",e=>{let m={title:"Meisterstück",body:"Zeit für deinen Schritt."};try{m=e.data.json()}catch(_){}
  const o={body:m.body,icon:"/icon-192.png",badge:"/icon-192.png",data:{step:!!m.step}};if(m.step)o.actions=[{action:"done",title:"Erledigt ✓"},{action:"open",title:"Öffnen"}];
  e.waitUntil(self.registration.showNotification(m.title,o))});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=e.action==="done"?"/?done=1#heute":"/#heute";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{const c=l[0];if(c){return (c.navigate?c.navigate(url):Promise.resolve(c)).then(w=>(w||c).focus())}return clients.openWindow(url)}))});
