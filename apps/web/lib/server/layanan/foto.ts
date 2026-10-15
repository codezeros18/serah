import { createHash } from "node:crypto";
import { evaluasiFoto, type HasilAturan } from "@serah/core/aturan";
import type { JenisFoto } from "@serah/kontrak";
import { konfigurasiAturan } from "../aturan";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { integrasi } from "../integrasi-stub";
import type { Sesi } from "../sesi";
import { rujukan, yurisdiksiKawasan } from "./wadah";

// Foto bukti (S08-3). Metadata dibuang SEBELUM disimpan (CLAUDE.md §2.5); R-04 untuk foto MUATAN.
// Foto MUATAN & TIKET wajib terkait serah (`serahKode`) agar pihak serah lain dapat melihatnya.

const MS_HARI = 86_400_000;

type Pembanding = { p_dhash: string; p_kode_serah: string; p_diterima_pada: Date };

/** R-04 terhadap foto MUATAN milik organisasi pengangkut atau terkait kawasan dalam jendela (kecuali foto ini). */
export async function evaluasiR04(
  tx: Tx,
  m: { kawasanId: string; orgPengangkutId: string; dhash: string; kecualiFotoId: string | null; sekarang: Date },
): Promise<HasilAturan[]> {
  const yurisdiksi = await yurisdiksiKawasan(tx, m.kawasanId);
  const konfigurasi = await konfigurasiAturan(tx, yurisdiksi, m.sekarang);
  const sejak = new Date(m.sekarang.getTime() - konfigurasi.R04_JENDELA_HARI * MS_HARI);
  const pembanding = await tx.$queryRaw<Pembanding[]>`
    SELECT * FROM foto_pembanding_r04(${m.kawasanId}, ${m.orgPengangkutId}, ${sejak}, ${m.kecualiFotoId})`;
  return evaluasiFoto(
    {
      yurisdiksi,
      sekarang: m.sekarang,
      dhash: m.dhash,
      pembanding: pembanding.map((p) => ({ dhash: p.p_dhash, kodeSerah: p.p_kode_serah, diambilPada: p.p_diterima_pada })),
    },
    konfigurasi,
  );
}

export type MasukanUnggah = { jenis: JenisFoto; serahKode?: string | undefined; berkas: Blob };

export async function unggahFoto(tx: Tx, sesi: Sesi, m: MasukanUnggah, sekarang: Date) {
  const organisasiId = sesi.organisasiAktifId;
  if (!organisasiId || !sesi.peran) throw new GalatApi("PERAN_TIDAK_BOLEH");

  let serah: { id: string; kawasanId: string } | null = null;
  if (m.jenis === "MUATAN" || m.jenis === "TIKET") {
    if (!m.serahKode) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["serahKode"], kode: "wajib" }] });
    // MUATAN diambil pengangkut, TIKET oleh penerima (§G).
    if ((m.jenis === "MUATAN" && sesi.peran !== "PENGANGKUT") || (m.jenis === "TIKET" && sesi.peran !== "PENERIMA")) throw new GalatApi("PERAN_TIDAK_BOLEH");
    serah = await tx.serah.findUnique({ where: { kode: m.serahKode }, select: { id: true, kawasanId: true } });
    if (!serah) throw new GalatApi("TIDAK_DITEMUKAN");
  }

  const mentah = new Uint8Array(await m.berkas.arrayBuffer());
  const f = await integrasi().foto.proses(mentah);

  if (m.jenis === "MUATAN" && serah) {
    const hasil = await evaluasiR04(tx, { kawasanId: serah.kawasanId, orgPengangkutId: organisasiId, dhash: f.dhash, kecualiFotoId: null, sekarang });
    const tolak = hasil.find((h) => h.aksi === "TOLAK");
    if (tolak) throw new GalatApi("ATURAN_DITOLAK", { aturan: rujukan(tolak) });
  }

  const kunci = `${organisasiId}/${m.jenis}/${createHash("sha256").update(f.isi).digest("hex")}.${f.ekstensi}`;
  await integrasi().penyimpanan.simpan(kunci, f.isi, f.mime);
  const foto = await tx.foto.create({
    data: {
      jenis: m.jenis,
      organisasiId,
      serahId: serah?.id ?? null,
      objectKey: kunci,
      dhash: f.dhash,
      ukuranByte: f.isi.length,
      lebar: f.lebar,
      tinggi: f.tinggi,
      diambilPada: null,
      diterimaPada: sekarang,
    },
    select: { id: true, dhash: true },
  });
  return { fotoId: foto.id, dhash: foto.dhash };
}

/** Foto serah yang terlihat sesi, dengan URL bertanda tangan 5 menit. Foto yang sudah dihapus retensi dilewati. */
export async function fotoSerah(tx: Tx, serahId: string, sekarang: Date) {
  const daftar = await tx.foto.findMany({
    where: { serahId, dihapusRetensiPada: null },
    select: { id: true, jenis: true, objectKey: true },
    orderBy: { diterimaPada: "asc" },
  });
  return daftar.map((f) => {
    const u = integrasi().penyimpanan.urlBertanda(f.objectKey, sekarang);
    return { id: f.id, jenis: f.jenis, url: u.url, kedaluwarsaPada: u.kedaluwarsaPada.toISOString() };
  });
}
