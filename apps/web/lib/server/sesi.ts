import { createHash, randomBytes } from "node:crypto";
import type { OrganisasiPeran, Peran, SesiKeluaran } from "@serah/kontrak";
import { denganAkses, denganAuth, type KonteksAkses, type Tx } from "./db";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";
import { hakPaket, paketOrganisasi } from "./hak";

// Sesi buatan sendiri (§P.1): token 32 byte acak di cookie __Host-serah; DB hanya menyimpan SHA-256(token + TOKEN_PEPPER).

export const NAMA_COOKIE = "__Host-serah";
const UMUR_SESI_MS = 30 * 24 * 60 * 60 * 1000;
/** Perpanjang bila sisa umur < 29 hari (paling sering sekali sehari per sesi). */
const AMBANG_PERPANJANG_MS = 29 * 24 * 60 * 60 * 1000;

export type Sesi = {
  id: string;
  penggunaId: string;
  organisasiAktifId: string | null;
  peran: Peran | null;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token + muatEnv().TOKEN_PEPPER, "utf8").digest("hex");
}

export function konteksAkses(sesi: Sesi): KonteksAkses {
  return { penggunaId: sesi.penggunaId, orgIds: sesi.organisasiAktifId ? [sesi.organisasiAktifId] : [], peran: sesi.peran };
}

export function cookieSesi(token: string): string {
  return `${NAMA_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${UMUR_SESI_MS / 1000}`;
}

export function cookieHapus(): string {
  return `${NAMA_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function bacaCookie(request: Request, nama: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const bagian of header.split(";")) {
    const [k, ...v] = bagian.trim().split("=");
    if (k === nama) return v.join("=") || null;
  }
  return null;
}

/** Buat sesi baru (dalam transaksi denganAuth). Mengembalikan token mentah untuk cookie — tidak pernah disimpan. */
export async function buatSesi(
  tx: Tx,
  data: { penggunaId: string; organisasiAktifId: string | null; peranAktif: Peran | null },
  sekarang: Date = new Date(),
): Promise<{ token: string; sesi: Sesi }> {
  const token = randomBytes(32).toString("base64url");
  const baris = await tx.sesi.create({
    data: {
      penggunaId: data.penggunaId,
      tokenHash: hashToken(token),
      organisasiAktifId: data.organisasiAktifId,
      peranAktif: data.peranAktif,
      kedaluwarsaPada: new Date(sekarang.getTime() + UMUR_SESI_MS),
    },
  });
  return { token, sesi: { id: baris.id, penggunaId: baris.penggunaId, organisasiAktifId: baris.organisasiAktifId, peran: baris.peranAktif } };
}

/** Baca & validasi sesi dari cookie. Keanggotaan aktif diperiksa ulang setiap kali; sesi diperpanjang (geser). */
export async function bacaSesi(request: Request, sekarang: Date = new Date()): Promise<Sesi | null> {
  const token = bacaCookie(request, NAMA_COOKIE);
  if (!token || token.length > 200) return null;
  return denganAuth(async (tx) => {
    const s = await tx.sesi.findUnique({ where: { tokenHash: hashToken(token) }, include: { pengguna: { select: { dihapusPada: true } } } });
    if (!s || s.dicabutPada || s.kedaluwarsaPada <= sekarang || s.pengguna.dihapusPada) return null;
    let organisasiAktifId = s.organisasiAktifId;
    let peran = s.peranAktif;
    if (organisasiAktifId && peran) {
      const anggota = await tx.keanggotaan.findFirst({
        where: { penggunaId: s.penggunaId, organisasiId: organisasiAktifId, peran, aktif: true },
        select: { id: true },
      });
      if (!anggota) {
        organisasiAktifId = null;
        peran = null;
      }
    }
    const sisa = s.kedaluwarsaPada.getTime() - sekarang.getTime();
    if (sisa < AMBANG_PERPANJANG_MS || organisasiAktifId !== s.organisasiAktifId) {
      await tx.sesi.update({
        where: { id: s.id },
        data: { kedaluwarsaPada: new Date(sekarang.getTime() + UMUR_SESI_MS), organisasiAktifId, peranAktif: peran },
      });
    }
    return { id: s.id, penggunaId: s.penggunaId, organisasiAktifId, peran };
  });
}

export async function wajibSesi(request: Request): Promise<Sesi> {
  const sesi = await bacaSesi(request);
  if (!sesi) throw new GalatApi("SESI_HABIS");
  return sesi;
}

export async function cabutSesi(sesiId: string): Promise<void> {
  await denganAuth((tx) => tx.sesi.update({ where: { id: sesiId }, data: { dicabutPada: new Date() } }));
}

/** Daftar organisasi & peran milik pengguna (keanggotaan aktif). */
export async function organisasiPengguna(tx: Tx, penggunaId: string): Promise<OrganisasiPeran[]> {
  const anggota = await tx.keanggotaan.findMany({
    where: { penggunaId, aktif: true },
    include: { organisasi: { select: { id: true, nama: true, jenis: true } } },
    orderBy: { dibuatPada: "asc" },
  });
  const per = new Map<string, OrganisasiPeran>();
  for (const a of anggota) {
    const o = per.get(a.organisasiId) ?? { id: a.organisasi.id, nama: a.organisasi.nama, jenis: a.organisasi.jenis, peran: [] };
    o.peran.push(a.peran);
    per.set(a.organisasiId, o);
  }
  return [...per.values()];
}

/** Isi GET /api/sesi. */
export async function keluaranSesi(sesi: Sesi): Promise<SesiKeluaran> {
  return denganAkses(konteksAkses(sesi), async (tx) => {
    const org = sesi.organisasiAktifId
      ? await tx.organisasi.findUnique({ where: { id: sesi.organisasiAktifId }, select: { id: true, kode: true, nama: true, jenis: true } })
      : null;
    const paket = org ? await paketOrganisasi(tx, org) : null;
    return {
      pengguna: { id: sesi.penggunaId },
      organisasiAktif: org,
      peran: org ? sesi.peran : null,
      paket,
      hak: paket ? await hakPaket(tx, paket) : [],
    };
  });
}
