import type { Prisma } from "@serah/db";
import type { AksiSinkron, Galat, StatusSinkron } from "@serah/kontrak";
import { denganAkses, type Tx } from "../db";
import { GalatApi } from "../galat";
import { pelanggaranUnik, sekaliSaja } from "../idempoten";
import { konteksAkses, type Sesi } from "../sesi";
import { ambilSerah, buatSerah, tutupSerah } from "./serah";
import { catatWadah } from "./wadah";

// POST /api/sinkron (S08-5, BLUEPRINT §F.6, §I.2). Antrean offline dikirim ≤20 aksi; tiap aksi:
// - transaksi sendiri (satu aksi gagal tidak membatalkan yang lain), diterapkan berurutan seperti dikirim;
// - kunci idempotensinya sendiri dengan nama rute yang SAMA dengan rute aslinya → aksi yang sempat terkirim online
//   lalu terulang dari antrean = DUPLIKAT, satu efek;
// - dinilai terhadap status saat diterima server; transisi yang sudah tidak sah → DITOLAK {TRANSISI_TIDAK_SAH},
//   aksi mentah dicatat di audit_log jenis SINKRON_DITOLAK.

const RUTE_AKSI: Record<AksiSinkron["jenis"], string> = {
  WADAH_CATAT: "POST /api/wadah",
  SERAH_BUAT: "POST /api/serah",
  SERAH_AMBIL: "POST /api/serah/[kode]/ambil",
  SERAH_TUTUP: "POST /api/serah/[kode]/tutup",
};

export type HasilSinkron = { idempotencyKey: string; status: StatusSinkron; galat?: Galat };

function jalankan(tx: Tx, sesi: Sesi, a: AksiSinkron, sekarang: Date): Promise<unknown> {
  const terjadiPada = new Date(a.terjadiPada);
  switch (a.jenis) {
    case "WADAH_CATAT":
      return catatWadah(tx, sesi, a.payload, a.idempotencyKey, sekarang, true);
    case "SERAH_BUAT":
      return buatSerah(tx, sesi, a.payload, a.idempotencyKey, sekarang, terjadiPada);
    case "SERAH_AMBIL": {
      const { kode, ...m } = a.payload;
      return ambilSerah(tx, sesi, kode, m, a.idempotencyKey, sekarang, terjadiPada);
    }
    case "SERAH_TUTUP": {
      const { kode, ...m } = a.payload;
      return tutupSerah(tx, sesi, kode, m, a.idempotencyKey, sekarang, terjadiPada);
    }
  }
}

async function catatDitolak(sesi: Sesi, a: AksiSinkron, g: GalatApi): Promise<void> {
  await denganAkses(konteksAkses(sesi), (tx) =>
    // createMany: audit_log hanya boleh dibaca admin (tanpa RETURNING).
    tx.auditLog.createMany({
      data: [
        {
          organisasiId: sesi.organisasiAktifId,
          peran: sesi.peran,
          aksi: "SINKRON_DITOLAK",
          objekJenis: a.jenis,
          objekId: a.idempotencyKey,
          data: { aksi: a, galat: { kode: g.kode, ...(g.aturan ? { aturan: g.aturan.kode } : {}) } } as Prisma.InputJsonValue,
        },
      ],
    }),
  );
}

export async function sinkronkan(sesi: Sesi, aksi: readonly AksiSinkron[], sekarang: Date): Promise<{ hasil: HasilSinkron[] }> {
  const hasil: HasilSinkron[] = [];
  for (const a of aksi) {
    try {
      const h = await sekaliSaja(sesi, a.idempotencyKey, RUTE_AKSI[a.jenis], (tx) => jalankan(tx, sesi, a, sekarang));
      hasil.push({ idempotencyKey: a.idempotencyKey, status: h.replay ? "DUPLIKAT" : "DITERAPKAN" });
    } catch (e) {
      if (!(e instanceof GalatApi)) throw e;
      await catatDitolak(sesi, a, e);
      hasil.push({ idempotencyKey: a.idempotencyKey, status: "DITOLAK", galat: e.amplop().galat });
    }
  }
  return { hasil };
}

/** Batch sinkron sendiri juga idempoten (header Idempotency-Key): kiriman ulang batch → respons batch yang sama. */
export async function sinkronIdempoten(sesi: Sesi, kunci: string, aksi: readonly AksiSinkron[], sekarang: Date): Promise<{ isi: { hasil: HasilSinkron[] }; replay: boolean }> {
  const organisasiId = sesi.organisasiAktifId;
  if (!organisasiId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const RUTE = "POST /api/sinkron";
  const baca = () =>
    denganAkses(konteksAkses(sesi), async (tx) => {
      const r = await tx.responsIdempoten.findUnique({ where: { kunci } });
      if (r && r.rute !== RUTE) throw new GalatApi("VALIDASI_GAGAL");
      return r ? (r.isi as { hasil: HasilSinkron[] }) : null;
    });
  const lama = await baca();
  if (lama) return { isi: lama, replay: true };
  const isi = await sinkronkan(sesi, aksi, sekarang);
  try {
    await denganAkses(konteksAkses(sesi), (tx) =>
      tx.responsIdempoten.create({ data: { kunci, organisasiId, rute: RUTE, statusHttp: 200, isi: isi as Prisma.InputJsonValue } }),
    );
  } catch (e) {
    if (!pelanggaranUnik(e)) throw e;
    const pemenang = await baca();
    if (pemenang) return { isi: pemenang, replay: true };
  }
  return { isi, replay: false };
}
