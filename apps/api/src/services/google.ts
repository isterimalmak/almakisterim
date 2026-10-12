// "Google ile devam et" (OAuth 2.0 / OpenID Connect, yetkilendirme kodu akışı).
export interface GoogleAuth {
  enabled: boolean;
  authUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<{ sub: string; email: string | null; name: string }>;
}

export class GoogleOAuth implements GoogleAuth {
  enabled = true;
  constructor(private clientId: string, private clientSecret: string) {}

  authUrl(state: string, redirectUri: string) {
    const p = new URLSearchParams({
      client_id: this.clientId, redirect_uri: redirectUri, response_type: "code",
      scope: "openid email profile", state, prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }

  async exchange(code: string, redirectUri: string) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tokenRes.ok) throw new Error(`Google token hatası ${tokenRes.status}`);
    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    if (!id_token) throw new Error("Google id_token dönmedi");
    // Jeton Google'ın kendi doğrulama ucunda kontrol edilir (imza, süre, alıcı).
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
    if (!infoRes.ok) throw new Error("Google kimlik doğrulanamadı");
    const info = (await infoRes.json()) as { aud?: string; sub?: string; email?: string; email_verified?: string; name?: string; iss?: string };
    if (info.aud !== this.clientId || !info.sub || !["accounts.google.com", "https://accounts.google.com"].includes(info.iss ?? "")) {
      throw new Error("Google kimliği bu uygulamaya ait değil");
    }
    return { sub: info.sub, email: info.email_verified === "true" ? (info.email ?? null) : null, name: info.name ?? "" };
  }
}

export const disabledGoogle: GoogleAuth = {
  enabled: false,
  authUrl: () => { throw new Error("Google girişi yapılandırılmadı"); },
  exchange: async () => { throw new Error("Google girişi yapılandırılmadı"); },
};
