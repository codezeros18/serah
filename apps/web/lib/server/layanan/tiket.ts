import { parseBeratKgKeGram } from "@serah/core/angka";
import { KEYAKINAN_AI, type KeyakinanAi } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { integrasi } from "../integrasi-stub";
import type { Sesi } from "../sesi";

// POST /api/tiket/baca (S08-4). AI hanya membaca tiket/nota timbang dan hasilnya SARAN berlabel; manusia mengonfirmasi
// di layar sebelum tercatat lewat /tutup (CLAUDE.md §2.4). Tanpa pembaca otomatis (ManualPembaca) → AI_TIDAK_TERSEDIA,
// layar memakai isian manual. Validasi rentang & enum dilakukan di sini, bukan dipercayakan ke model.

const PANJANG_TEKS_MAKS = 60;

function teksAman(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, PANJANG_TEKS_MAKS);
}

export async function bacaTiket(tx: Tx, sesi: Sesi, fotoId: string) {
  if (sesi.peran !== "PENERIMA") throw new GalatApi("PERAN_TIDAK_BOLEH");
  const foto = await tx.foto.findUnique({ where: { id: fotoId }, select: { jenis: true, objectKey: true, serahId: true, dihapusRetensiPada: true } });
  if (!foto || foto.jenis !== "TIKET" || !foto.serahId || foto.dihapusRetensiPada) throw new GalatApi("TIDAK_DITEMUKAN");
  const isi = await integrasi().penyimpanan.baca(foto.objectKey);
  if (!isi) throw new GalatApi("TIDAK_DITEMUKAN");
  const mime = foto.objectKey.endsWith(".png") ? "image/png" : foto.objectKey.endsWith(".webp") ? "image/webp" : "image/jpeg";

  const h = await integrasi().pembacaTiket.baca({ isi, mime });
  // Berat yang tidak bisa diurai sebagai kg Indonesia tidak diteruskan (layar meminta isian manual).
  const beratKgTeks = teksAman(h.beratKgTeks);
  const beratSah = beratKgTeks !== null && parseBeratKgKeGram(beratKgTeks).ok;
  const keyakinan: KeyakinanAi = (KEYAKINAN_AI as readonly string[]).includes(String(h.keyakinan).toUpperCase())
    ? (String(h.keyakinan).toUpperCase() as KeyakinanAi)
    : "RENDAH";
  return {
    nomorTiket: teksAman(h.nomorTiket),
    beratKgTeks: beratSah ? beratKgTeks : null,
    tanggal: teksAman(h.tanggal),
    keyakinan: beratSah ? keyakinan : "RENDAH",
    model: h.model,
  };
}
