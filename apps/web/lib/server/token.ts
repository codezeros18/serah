import { createHash, randomBytes } from "node:crypto";
import { normalisasiEmail } from "@serah/core/akun";
import { muatEnv } from "./env";

// Token acak & sidik ber-pepper (§P.1). DB hanya menyimpan sidik, tidak pernah token, email undangan, atau IP mentah.

/** Token 32 byte acak (base64url). */
export function buatToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256(nilai + TOKEN_PEPPER), hex. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token + muatEnv().TOKEN_PEPPER, "utf8").digest("hex");
}

/** Sidik email (undangan, kunci batas laju). Email dinormalisasi lebih dulu. */
export function hashEmail(email: string): string {
  return hashToken(`email:${normalisasiEmail(email)}`);
}

/** Sidik IP untuk batas laju; IP mentah tidak pernah disimpan atau dicatat. */
export function hashIp(ip: string): string {
  return hashToken(`ip:${ip}`);
}

/** IP klien dari proxy (Railway mengisi X-Forwarded-For). */
export function ipPermintaan(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  const pertama = xff?.split(",")[0]?.trim();
  return pertama || request.headers.get("x-real-ip") || "-";
}
