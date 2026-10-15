import type { PengirimRekam } from "../../adaptor/email";
import { muatEnv } from "../env";

// Pembantu test integrasi rute: Request ber-Origin sah, IP unik (batas laju), cookie, token dari email terekam.

export const asal = () => new URL(muatEnv().BASE_URL).origin;

let ipKe = 0;
export const ipBaru = () => `198.51.100.${(ipKe++ % 250) + 1}-${Date.now()}`;

export type InitUji = { metode?: string; body?: unknown; cookie?: string; ip?: string };

export function permintaan(jalur: string, { metode = "POST", body, cookie, ip }: InitUji = {}): Request {
  const headers: Record<string, string> = { origin: asal(), "content-type": "application/json", "x-forwarded-for": ip ?? ipBaru() };
  if (cookie) headers.cookie = cookie;
  return new Request(`${asal()}${jalur}`, { method: metode, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

export const cookieDari = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/** Alamat uji di TLD .test (RFC 2606) — tidak pernah alamat nyata. */
export const emailBaru = () => `uji-${Math.random().toString(36).slice(2, 10)}@contoh.test`;

export function tokenTerakhir(rekam: PengirimRekam, ke: string, jalur: string): string {
  const pesan = [...rekam.terkirim].reverse().find((p) => p.ke === ke && p.teks.includes(jalur));
  const t = pesan?.teks.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  if (!t) throw new Error(`Email ${jalur} tidak ditemukan`);
  return t;
}
