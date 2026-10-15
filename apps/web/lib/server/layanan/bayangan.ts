import { bandingkanBayangan } from "@serah/core/bayangan";
import { hitungNeraca, jumlahkanPerAliran } from "@serah/core/neraca";
import { akhirPeriodeWib, awalPeriodeWib } from "@serah/core/waktu";
import { ALIRAN, type Aliran } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { boleh } from "../hak";
import type { Sesi } from "../sesi";
import { dataNeraca } from "./laporan";

// Mode bayangan (S24-4, FITUR F40). PENGELOLA kawasan dengan hak `mode_bayangan`: memasukkan angka catatan lama
// per periode & aliran, lalu membandingkan dengan berat yang dicatat di TPS (nilai final). Selisih dua arah, tanpa menilai.
// Entri bersifat catat-saja: salah ketik dikoreksi dengan entri baru (angka entri dijumlahkan per aliran).

async function kawasanMilik(tx: Tx, sesi: Sesi, kawasanId: string): Promise<{ id: string; orgId: string }> {
  const orgId = sesi.organisasiAktifId;
  if (!orgId || sesi.peran !== "PENGELOLA") throw new GalatApi("PERAN_TIDAK_BOLEH");
  if (!(await boleh(tx, orgId, "mode_bayangan"))) throw new GalatApi("HAK_PAKET_TIDAK_ADA");
  const k = await tx.kawasan.findUnique({ where: { id: kawasanId }, select: { id: true, organisasiId: true } });
  if (!k || k.organisasiId !== orgId) throw new GalatApi("TIDAK_DITEMUKAN");
  return { id: k.id, orgId };
}

export async function tambahBayangan(
  tx: Tx,
  sesi: Sesi,
  m: { kawasanId: string; periode: string; aliran: Aliran; beratG: number; sumberCatatan: string },
  sekarang: Date,
): Promise<{ id: string }> {
  const k = await kawasanMilik(tx, sesi, m.kawasanId);
  const baru = await tx.bayanganEntri.create({
    data: { kawasanId: k.id, orgKawasanId: k.orgId, periode: m.periode, aliran: m.aliran, beratG: m.beratG, sumberCatatan: m.sumberCatatan.trim(), dibuatPada: sekarang },
    select: { id: true },
  });
  return { id: baru.id };
}

export async function perbandinganBayangan(tx: Tx, sesi: Sesi, kawasanId: string, periode: string) {
  const k = await kawasanMilik(tx, sesi, kawasanId);
  const entri = await tx.bayanganEntri.findMany({
    where: { kawasanId: k.id, periode },
    orderBy: { dibuatPada: "asc" },
    select: { aliran: true, beratG: true, sumberCatatan: true },
  });
  const data = await dataNeraca(tx, k.id, awalPeriodeWib(periode), akhirPeriodeWib(periode));
  const jumlah = jumlahkanPerAliran(hitungNeraca(data, { kelompok: "KAWASAN", periode: "SEMUA" }));
  const serahPerAliran = Object.fromEntries(ALIRAN.map((a) => [a, jumlah[a].dicatatG])) as Record<Aliran, number>;
  const baris = bandingkanBayangan(serahPerAliran, entri).map((b) => ({
    aliran: b.aliran,
    serahG: b.serahG,
    bayanganG: b.bayanganG,
    selisihG: b.selisihG,
    sumberCatatan: [...b.sumberCatatan],
  }));
  return { periode, baris };
}
