// Android uygulamasının (Trusted Web Activity) siteyi adres çubuğu olmadan açabilmesi için site uygulamayı tanır.
// Parmak izleri gizli değildir: Google Play Console → Uygulama bütünlüğü → Uygulama imzalama sayfasındaki SHA-256 değerleri,
// GitHub → Settings → Variables → ANDROID_CERT_SHA256 olarak (virgülle ayrılmış) girilir ve yayında siteye verilir.
export const dynamic = "force-dynamic";

export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  const body = prints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.almakisterim.app", sha256_cert_fingerprints: prints } }]
    : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
