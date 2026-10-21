import { createServer, type Server } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNotifiers, mailProvider, SmtpMailer, smtpFrom } from "../src/services/notify.js";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

// Testte gerçek sunucu yerine küçük bir sahte SMTP sunucusu: AUTH PLAIN kabul eder, gelen iletiyi saklar.
function fakeSmtp(pass: string) {
  const got: { from: string; to: string; data: string; authOk: boolean }[] = [];
  const server: Server = createServer((sock) => {
    let mode: "cmd" | "data" = "cmd"; let buf = ""; let cur = { from: "", to: "", data: "", authOk: false };
    sock.write("220 sahte SMTP hazir\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (mode === "data") {
          if (line === ".") { mode = "cmd"; got.push(cur); cur = { from: "", to: "", data: "", authOk: cur.authOk }; sock.write("250 tamam\r\n"); }
          else cur.data += line + "\n";
          continue;
        }
        const up = line.toUpperCase();
        if (up.startsWith("EHLO") || up.startsWith("HELO")) sock.write("250-sahte\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (up.startsWith("AUTH PLAIN")) {
          const dec = Buffer.from(line.split(" ")[2] ?? "", "base64").toString("utf8").split("\0");
          cur.authOk = dec[2] === pass; sock.write(cur.authOk ? "235 kabul\r\n" : "535 yanlis\r\n");
        } else if (up.startsWith("MAIL FROM")) { cur.from = line; sock.write("250 tamam\r\n"); }
        else if (up.startsWith("RCPT TO")) { cur.to = line; sock.write("250 tamam\r\n"); }
        else if (up === "DATA") { mode = "data"; sock.write("354 yaz\r\n"); }
        else if (up === "QUIT") { sock.end("221 gule gule\r\n"); }
        else sock.write("250 tamam\r\n");
      }
    });
  });
  return { got, server, listen: () => new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as { port: number }).port))) };
}

const base = { RESEND_API_KEY: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" };

describe("e-posta gönderimi: kendi sunucu (SMTP)", () => {
  it("hangi yol kullanılır: SMTP bilgileri tamsa SMTP, yoksa Resend, ikisi de yoksa kapalı", () => {
    expect(mailProvider(base)).toBeNull();
    expect(mailProvider({ ...base, RESEND_API_KEY: "re_x" })).toBe("resend");
    expect(mailProvider({ ...base, RESEND_API_KEY: "re_x", SMTP_HOST: "mail.almakisterim.com", SMTP_USER: "bildirim@almakisterim.com" })).toBe("resend");
    expect(mailProvider({ ...base, RESEND_API_KEY: "re_x", SMTP_HOST: "mail.almakisterim.com", SMTP_USER: "bildirim@almakisterim.com", SMTP_PASS: "s" })).toBe("smtp");
  });

  it("gönderen: aynı alan adındaysa \"Gönderen\" alanı, değilse SMTP hesabının adresi", () => {
    const c = { MAIL_FROM: "almakisterim <bildirim@almakisterim.com>", SMTP_USER: "bildirim@almakisterim.com" } as Parameters<typeof smtpFrom>[0];
    expect(smtpFrom(c)).toBe("almakisterim <bildirim@almakisterim.com>");
    expect(smtpFrom({ ...c, SMTP_USER: "hesap@gmail.com" })).toBe("almakisterim <hesap@gmail.com>");
  });

  it("SMTP ile html'li e-posta gerçekten sunucuya gider; yanlış şifre reddedilir", async () => {
    const f = fakeSmtp("dogru-sifre");
    const port = await f.listen();
    try {
      const n = createNotifiers({ ...base, APP_URL: "https://almakisterim.com", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_USER: "bildirim@almakisterim.com", SMTP_PASS: "dogru-sifre", MAIL_FROM: "almakisterim <bildirim@almakisterim.com>", isProd: true, NETGSM_USERCODE: "", NETGSM_PASSWORD: "", NETGSM_HEADER: "" } as never);
      await n.mailer.send("alici@example.com", "Merhaba", "Düz metin", { html: "<b>Kalın</b>" });
      // html verilmeyen sistem e-postası marka şablonuyla gider
      await n.mailer.send("alici@example.com", "almakisterim giriş kodunuz", "almakisterim giriş kodunuz: 123456. Kod 10 dakika geçerlidir.");
      expect(f.got).toHaveLength(2);
      expect(f.got[1]!.data).toContain("text/html");
      expect(f.got[1]!.data).toContain("123456");
      expect(f.got[0]!.authOk).toBe(true);
      expect(f.got[0]!.to).toContain("alici@example.com");
      expect(f.got[0]!.from).toContain("bildirim@almakisterim.com");
      expect(f.got[0]!.data).toContain("text/html");
      const bad = new SmtpMailer("127.0.0.1", port, "bildirim@almakisterim.com", "yanlis", "x <bildirim@almakisterim.com>");
      await expect(bad.verify()).rejects.toBeTruthy();
    } finally { f.server.close(); }
  });
});

describe("yönetim → entegrasyonlar → SMTP kartı", () => {
  let ctx: TestCtx; let admin: string;
  beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); admin = await login(ctx, "yonetici@almakisterim.com"); });
  afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

  it("kart listede; şifre hiç dönmez; eksik bilgide ve ulaşılamayan sunucuda anlaşılır mesaj verir", async () => {
    const groups = (await ctx.app.inject({ url: "/api/admin/integrations", headers: { cookie: admin } })).json().groups;
    const g = groups.find((x: { id: string }) => x.id === "smtp");
    expect(g.fields.map((f: { key: string }) => f.key)).toEqual(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]);
    const test = () => ctx.app.inject({ method: "POST", url: "/api/admin/integrations/smtp/test", headers: { cookie: admin } });
    expect((await test()).json()).toMatchObject({ ok: false, message: expect.stringContaining("girilmeli") });
    for (const [k, v] of [["SMTP_HOST", "127.0.0.1"], ["SMTP_PORT", "1"], ["SMTP_USER", "bildirim@almakisterim.com"], ["SMTP_PASS", "gizli-sifre-123"]]) {
      expect((await ctx.app.inject({ method: "PUT", url: `/api/admin/integrations/${k}`, headers: { cookie: admin }, payload: { value: v } })).statusCode).toBe(200);
    }
    const after = (await ctx.app.inject({ url: "/api/admin/integrations", headers: { cookie: admin } }));
    expect(after.body).not.toContain("gizli-sifre-123");
    const r = (await test()).json();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Sunucuya bağlanılamadı/);
    expect(r.message).not.toContain("gizli-sifre-123");
  });
});
