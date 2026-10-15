import { createHmac } from "node:crypto";
import { kodeTps } from "@serah/core/kode";
import type { Tps } from "@serah/kontrak";
import QRCode from "qrcode";
import { batas } from "../hak";
import type { Tx } from "../db";
import { muatEnv } from "../env";
import { GalatApi } from "../galat";
import { idBaru } from "../id";
import { nomorBerikut } from "../penomoran";
import type { Sesi } from "../sesi";
import { muatKawasanMilik } from "./organisasi";
import { hashTokenQr } from "./wadah";

// Layanan TPS & QR (S13). Koordinat = lokasi tetap TPS yang diisi pengelola (bukan lokasi perangkat); API menerima
// latE6/lonE6 bulat — teks "-6,161234" diparse klien oleh core/angka.parseKoordinatKeE6.
//
// Token QR: 32 byte, hanya SIDIKNYA disimpan (`qr_token_hash`). Agar QR bisa dicetak ulang tanpa menyimpan token,
// token diturunkan HMAC-SHA256(TOKEN_PEPPER, "qr-tps|<tpsId>|<qrVersi>"): tak dapat ditebak tanpa pepper, dan
// QR baru menaikkan `qr_versi` sehingga QR lama langsung tidak dikenal.

export function tokenQrTps(tpsId: string, versi: number): string {
  return createHmac("sha256", muatEnv().TOKEN_PEPPER).update(`qr-tps|${tpsId}|${versi}`, "utf8").digest("base64url");
}

type BarisTps = { id: string; kawasanId: string; kode: string; nama: string; latE6: number; lonE6: number; aktif: boolean; qrVersi: number };

export function keDtoTps(t: BarisTps): Tps {
  return { id: t.id, kawasanId: t.kawasanId, kode: t.kode as Tps["kode"], nama: t.nama, latE6: t.latE6, lonE6: t.lonE6, aktif: t.aktif, qrVersi: t.qrVersi };
}

async function wajibBatasTps(tx: Tx, organisasiId: string): Promise<void> {
  const maks = await batas(tx, organisasiId, "tps.maks");
  if (maks === null) return;
  const aktif = await tx.tps.count({ where: { organisasiId, aktif: true } });
  if (aktif >= maks) throw new GalatApi("HAK_PAKET_TIDAK_ADA");
}

export async function buatTps(tx: Tx, sesi: Sesi, m: { kawasanId: string; nama: string; latE6: number; lonE6: number }, sekarang: Date): Promise<Tps> {
  const kawasan = await muatKawasanMilik(tx, sesi, m.kawasanId);
  await wajibBatasTps(tx, kawasan.organisasiId);
  const kode = kodeTps(kawasan.kode, await nomorBerikut(tx, "TPS", kawasan.kode));
  if (!kode.ok) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["kawasanId"], kode: "tps_penuh" }] });
  const id = idBaru();
  const t = await tx.tps.create({
    data: {
      id,
      kawasanId: kawasan.id,
      organisasiId: kawasan.organisasiId,
      kode: kode.kode,
      nama: m.nama,
      latE6: m.latE6,
      lonE6: m.lonE6,
      qrTokenHash: hashTokenQr(tokenQrTps(id, 1)),
      qrVersi: 1,
      aktif: true,
      dibuatPada: sekarang,
    },
  });
  return keDtoTps(t);
}

export async function daftarTps(tx: Tx, sesi: Sesi, kawasanId?: string): Promise<Tps[]> {
  if (kawasanId) await muatKawasanMilik(tx, sesi, kawasanId);
  if (!sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const baris = await tx.tps.findMany({
    where: { organisasiId: sesi.organisasiAktifId, ...(kawasanId ? { kawasanId } : {}) },
    orderBy: { kode: "asc" },
  });
  return baris.map(keDtoTps);
}

/** TPS milik organisasi aktif sesi; milik organisasi lain (walau terlihat lewat kontrak) → 404. */
async function muatTpsMilik(tx: Tx, sesi: Sesi, id: string) {
  const t = await tx.tps.findUnique({ where: { id } });
  if (!t || !sesi.organisasiAktifId || t.organisasiId !== sesi.organisasiAktifId) throw new GalatApi("TIDAK_DITEMUKAN");
  return t;
}

export async function ubahTps(
  tx: Tx,
  sesi: Sesi,
  id: string,
  m: Partial<{ nama: string; latE6: number; lonE6: number; aktif: boolean }>,
): Promise<Tps> {
  const kini = await muatTpsMilik(tx, sesi, id);
  if (m.aktif === true && !kini.aktif) await wajibBatasTps(tx, kini.organisasiId);
  return keDtoTps(await tx.tps.update({ where: { id }, data: m }));
}

/** QR baru: versi naik, sidik token diganti → QR lama langsung tidak dikenal. Mengembalikan token baru. */
export async function qrBaru(tx: Tx, sesi: Sesi, id: string): Promise<{ qrVersi: number; qrToken: string }> {
  const kini = await muatTpsMilik(tx, sesi, id);
  const versi = kini.qrVersi + 1;
  const token = tokenQrTps(id, versi);
  await tx.tps.update({ where: { id }, data: { qrVersi: versi, qrTokenHash: hashTokenQr(token) } });
  return { qrVersi: versi, qrToken: token };
}

/**
 * Isi QR yang berlaku untuk dicetak. Hanya bila sidik token turunan = sidik tersimpan. TPS demo (seed, DEMO_MODE)
 * memakai token yang dapat ditebak `demo-qr-<kode>`; selain itu tidak ada token yang bisa dibangun → 404.
 */
export async function tokenQrBerlaku(tx: Tx, sesi: Sesi, id: string): Promise<string> {
  const t = await muatTpsMilik(tx, sesi, id);
  const turunan = tokenQrTps(t.id, t.qrVersi);
  if (hashTokenQr(turunan) === t.qrTokenHash) return turunan;
  const demo = `demo-qr-${t.kode}`;
  if (muatEnv().DEMO_MODE && hashTokenQr(demo) === t.qrTokenHash) return demo;
  throw new GalatApi("TIDAK_DITEMUKAN");
}

export async function gambarQr(token: string, format: "png" | "svg"): Promise<{ isi: Uint8Array<ArrayBuffer> | string; mime: string }> {
  if (format === "svg") return { isi: await QRCode.toString(token, { type: "svg", margin: 2, errorCorrectionLevel: "M" }), mime: "image/svg+xml" };
  const buf = await QRCode.toBuffer(token, { type: "png", margin: 2, width: 512, errorCorrectionLevel: "M" });
  return { isi: Uint8Array.from(buf), mime: "image/png" };
}
