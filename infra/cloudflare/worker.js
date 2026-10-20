// almakisterim.com önündeki Cloudflare Worker.
// /api/* isteklerini API servisine, diğer her şeyi site servisine (Cloud Run) iletir.
// Böylece site ve API aynı adres altında çalışır, oturum çerezi tek alan adında kalır.
// Adresler gizli değildir; Cloudflare panelinde değişken tanımlanırsa onlar kullanılır.
const API = "https://almakisterim-api-n4hxtov3ia-ey.a.run.app";
const WEB = "https://almakisterim-web-n4hxtov3ia-ey.a.run.app";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // http:// ve www. ile gelenler tek adrese, https://almakisterim.com'a yönlenir ("Güvenli Değil" uyarısı çıkmasın).
    if (url.hostname.startsWith("www.") || url.protocol === "http:") {
      url.hostname = url.hostname.replace(/^www\./, "");
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const upstream = new URL(url.pathname + url.search, isApi ? (env.API_ORIGIN || API) : (env.WEB_ORIGIN || WEB));
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    const res = await fetch(upstream, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    // Tarayıcı bir kez https gördükten sonra siteyi hep https ile açar (HSTS).
    const out = new Response(res.body, res);
    out.headers.set("strict-transport-security", "max-age=31536000");
    return out;
  },
};
