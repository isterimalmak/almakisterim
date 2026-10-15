import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import type { Pool } from "./db.js";
import { HttpError, sha256 } from "./lib/util.js";
import type { AiService } from "./services/ai.js";
import type { GoogleAuth } from "./services/google.js";
import type { Mailer, Sms } from "./services/notify.js";
import type { PhotoSource } from "./services/pexels.js";
import type { MediaStorage } from "./services/storage.js";
import type { Integrations } from "./services/integrations.js";

export type Deps = {
  config: Config;
  pool: Pool;
  ai: AiService;
  mailer: Mailer;
  sms: Sms;
  google: GoogleAuth;
  storage: MediaStorage;
  // Stok fotoğraf araması; verilmezse yapılandırmadaki anahtarla oluşturulur.
  photos?: PhotoSource;
  // Panelden girilen anahtarlar (yönetim → Entegrasyonlar). Verilmezse buildApp yalnızca okuyup yapılandırmaya uygular.
  integrations?: Integrations;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "user" | "admin";
  is_corporate: boolean;
  credits: number;
};

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export const SESSION_COOKIE = "ak_session";
export const SESSION_DAYS = 30;

export async function loadUser(pool: Pool, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await pool.query<SessionUser>(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_corporate, u.credits
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw new HttpError(401, "giris_gerekli", "Bu işlem için giriş yapmalısınız.");
  return req.user;
}

export function requireAdmin(req: FastifyRequest): SessionUser {
  const u = requireUser(req);
  if (u.role !== "admin") throw new HttpError(403, "yetki_yok", "Bu sayfa yalnızca yöneticiler içindir.");
  return u;
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}
