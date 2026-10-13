// almakisterim.com uygulama çalışanı: hiçbir sayfayı veya API yanıtını önbelleğe almaz (veriler hep güncel kalsın).
// Yalnızca internet yokken sayfa açılmak istenirse "bağlantı yok" ekranı gösterir.
const OFFLINE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bağlantı yok · almakisterim.com</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#F3F4F7;color:#1d2433;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}
.m{width:64px;height:64px;border-radius:16px;background:#F26B1D;color:#fff;font:700 40px/64px Arial,sans-serif;margin:0 auto 16px}button{margin-top:16px;background:#13235B;color:#fff;border:0;border-radius:6px;padding:12px 20px;font-size:15px}</style></head>
<body><div><div class="m">a</div><h1 style="font-size:20px">İnternet bağlantısı yok</h1><p>Bağlantınız gelince tekrar deneyin.</p><button onclick="location.reload()">Tekrar dene</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
