import { randomBytes } from "node:crypto";
import { expect } from "vitest";
import { POST as demo } from "@/app/api/auth/demo/route";
import { POST as buatOrganisasi } from "@/app/api/organisasi/route";
import type { PengirimRekam } from "../../adaptor/email";
import { idBaru } from "../id";
import { hashToken } from "../token";
import { kueriPemilik } from "./db";
import { cookieDari, emailBaru, permintaan } from "./http";

// Pembantu test integrasi S13+. Alur daftar → verifikasi → masuk (argon2) sudah dibuktikan test S07; di sini akun uji
// disisipkan langsung (pengguna terverifikasi + persetujuan PDP + sesi) agar test tidak membebani CPU/DB bersama.

export const VERSI_PERSETUJUAN = "PRIV-2026-10-1";
export const SANDI_UJI = "sandi-uji-panjang-1";

export type AkunUji = { email: string; cookie: string; penggunaId: string };

/** Akun terverifikasi dengan sesi aktif tanpa organisasi. Parameter `_rekam` dipertahankan agar pemanggil tidak berubah. */
export async function akunBaru(_rekam?: PengirimRekam): Promise<AkunUji> {
  const email = emailBaru();
  const penggunaId = idBaru();
  const token = randomBytes(32).toString("base64url");
  await kueriPemilik(
    `WITH p AS (INSERT INTO pengguna (id, email, email_terverifikasi_pada) VALUES ($1, $2, now())),
          s AS (INSERT INTO persetujuan_pdp (id, pengguna_id, versi, jenis) VALUES ($3, $1, $4, 'LAYANAN'))
     INSERT INTO sesi (id, pengguna_id, token_hash, kedaluwarsa_pada) VALUES ($5, $1, $6, now() + interval '30 days')`,
    [penggunaId, email, idBaru(), VERSI_PERSETUJUAN, idBaru(), hashToken(token)],
  );
  return { email, cookie: `__Host-serah=${token}`, penggunaId };
}

export type OrgUji = AkunUji & { organisasiId: string };

type MasukanOrgUji = { jenis: "KAWASAN" | "PENGANGKUT" | "PENERIMA"; nama?: string; jenisPenerima?: string; aliranDiterima?: string[] };

/** Akun baru + organisasi baru lewat API (pembuat = pengurus; sesi sudah aktif di organisasi itu). */
export async function orgBaru(rekam: PengirimRekam, m: MasukanOrgUji): Promise<OrgUji> {
  const a = await akunBaru(rekam);
  const { nama, ...lain } = m;
  const r = await buatOrganisasi(
    permintaan("/api/organisasi", { cookie: a.cookie, body: { yurisdiksi: "DKI", nama: nama ?? `Organisasi Uji ${Math.random().toString(36).slice(2, 7)}`, ...lain } }),
  );
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
  return { ...a, organisasiId: (await r.json()).data.organisasi.id };
}

export async function cookieDemo(peran: "PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA" | "ADMIN"): Promise<string> {
  const r = await demo(permintaan("/api/auth/demo", { body: { peran } }));
  expect(r.status).toBe(200);
  return cookieDari(r);
}
