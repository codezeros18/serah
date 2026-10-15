import { randomUUID } from "node:crypto";
import { TEKS } from "@serah/kontrak";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { aturIntegrasi, cuacaTanpaJaringan, integrasi, manualPembaca, type PrakiraanMentah } from "@/lib/server/integrasi-stub";
import { jalankanCron } from "@/lib/server/layanan/cron";
import { data, demo, formFoto, masuk, panggil, pngContoh, satu, type DemoS08 } from "@/lib/server/uji/klien";
import { GET as cuaca } from "./cuaca/[adm4]/route";
import { POST as unggah } from "./foto/route";
import { GET as verifikasi } from "./rantai/verifikasi/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { GET as detail } from "./serah/[kode]/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as bacaTiket } from "./tiket/baca/route";
import { GET as menunggu } from "./tps/[id]/menunggu/route";
import { GET as prioritas } from "./tps/[id]/prioritas/route";
import { POST as catatWadah } from "./wadah/route";

// S08-8 — T18: alur inti penuh TANPA AI dan TANPA jaringan. Pembaca tiket = ManualPembaca; cuaca dari snapshot
// tersimpan; fetch global dibuat melempar sehingga satu pun panggilan jaringan langsung menggagalkan test.

let d: DemoS08;
let c: Record<"petugas" | "pengelola" | "pengangkut" | "penerima", string>;
const fetchAsli = globalThis.fetch;
const panggilanJaringan = vi.fn(() => {
  throw new Error("T18: panggilan jaringan dilarang");
});

beforeAll(async () => {
  d = await demo();
  const [petugas, pengelola, pengangkut, penerima] = await Promise.all([masuk("PETUGAS"), masuk("PENGELOLA"), masuk("PENGANGKUT"), masuk("PENERIMA")]);
  c = { petugas, pengelola, pengangkut, penerima };
  globalThis.fetch = panggilanJaringan as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchAsli;
  aturIntegrasi({ cuaca: cuacaTanpaJaringan, pembacaTiket: manualPembaca });
});

describe("T18 — alur inti tanpa AI & tanpa jaringan", () => {
  it("bawaan: pembaca tiket manual, sumber cuaca tanpa jaringan", () => {
    expect(integrasi().pembacaTiket).toBe(manualPembaca);
  });

  it("catat → serah → foto → ambil → setujui → tiket manual → tutup sebagian → laporan rantai utuh; prioritas dari snapshot", async () => {
    // Snapshot BMKG (berkas, bukan jaringan) dimuat lewat cron tiga-jam.
    const analisis = new Date(Math.floor((Date.now() - 2 * 3_600_000) / 1000) * 1000);
    const snapshot: PrakiraanMentah = {
      adm4: "31.71.03.1001",
      analysisDate: analisis,
      mode: "SNAPSHOT",
      slot: [1, 4, 7].map((j) => ({ slotUtc: new Date(analisis.getTime() + (j + 2) * 3_600_000), weatherDesc: j === 4 ? "Hujan Petir" : "Cerah Berawan", weatherDescEn: null })),
    };
    aturIntegrasi({ cuaca: { prakiraan: async (adm4) => (adm4 === snapshot.adm4 ? snapshot : null), nowcast: async () => null } });
    expect((await jalankanCron("tiga-jam", new Date(), { jendela: `uji-t18-${randomUUID()}` })).dilewati).toBe(false);
    const cu = data<{ mode: string; basi: boolean }>(await panggil(cuaca, { jalur: "/", cookie: c.petugas, params: { adm4: "31.71.03.1001" } }));
    expect(cu).toMatchObject({ mode: "SNAPSHOT", basi: false });

    // Petugas: dua wadah KUNING (satu tanpa berat — tetap tercatat).
    const w1 = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: c.petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 12_000, terjadiPada: new Date().toISOString() } }));
    const w2 = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: c.petugas, body: { tpsId: d.tps1, aliran: "KUNING", jumlahWadah: 2, terjadiPada: new Date().toISOString() } }));
    const mm = data<{ wadah: { id: string; beratG: number | null }[] }>(await panggil(menunggu, { jalur: "/", cookie: c.petugas, params: { id: d.tps1 } }));
    expect(mm.wadah.find((w) => w.id === w2.id)?.beratG).toBeNull();
    const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: c.petugas, body: { tpsId: d.tps1, wadahIds: [w1.id, w2.id] } })).kode;

    // Pengangkut: foto muatan → ambil.
    const muatan = data<{ fotoId: string }>(
      await panggil(unggah, { jalur: "/api/foto", cookie: c.pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) }),
    ).fotoId;
    expect(data(await panggil(ambil, { jalur: "/", cookie: c.pengangkut, params: { kode }, body: { fotoId: muatan, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }))).toMatchObject({ status: "MENUNGGU_SETUJU" });

    // Pengelola: setujui.
    expect(data(await panggil(setujui, { jalur: "/", cookie: c.pengelola, params: { kode }, body: {} }))).toMatchObject({ status: "DIANGKUT" });

    // Penerima: foto tiket → pembacaan otomatis tidak tersedia → isian manual → tutup sebagian.
    const tiket = data<{ fotoId: string }>(
      await panggil(unggah, { jalur: "/api/foto", cookie: c.penerima, kunci: null, form: formFoto("TIKET", pngContoh(randomUUID()), "image/png", kode) }),
    ).fotoId;
    const baca = await panggil(bacaTiket, { jalur: "/", cookie: c.penerima, kunci: null, body: { fotoId: tiket } });
    expect(baca.json.galat).toMatchObject({ kode: "AI_TIDAK_TERSEDIA", pesan: TEKS.G_AI_MATI });
    const t = data<{ status: string; peringatan: unknown[] }>(
      await panggil(tutup, {
        jalur: "/",
        cookie: c.penerima,
        params: { kode },
        body: { tiket: { fotoId: tiket, beratG: 14_000, sumber: "MANUAL", nomor: "M-01" }, rincian: [{ aliran: "KUNING", diterimaG: 13_000, ditolakG: 1_000, alasan: "BASAH_KOTOR" }] },
      }),
    );
    // Satu wadah tanpa berat → R-08 tidak dinilai (tanpa tebakan).
    expect(t).toEqual({ kode, status: "DITERIMA_SEBAGIAN", versi: 4, peringatan: [] });

    const det = data<{ tiket: { sumber: string; aiModel: string | null }; foto: { jenis: string }[] }>(await panggil(detail, { jalur: "/", cookie: c.pengelola, params: { kode } }));
    expect(det.tiket).toMatchObject({ sumber: "MANUAL", aiModel: null });
    expect(det.foto.map((f) => f.jenis).sort()).toEqual(["MUATAN", "TIKET"]);
    expect(data(await panggil(verifikasi, { jalur: `/api/rantai/verifikasi?kawasanId=${d.kawasan}`, cookie: c.pengelola }))).toMatchObject({ utuh: true });

    // R-10 dari snapshot: wadah ABU 30 jam belum diserahkan + hujan dalam horizon → PRAKIRAAN; cron mencatatnya.
    data(await panggil(catatWadah, { jalur: "/api/wadah", cookie: c.petugas, body: { tpsId: d.tps2, aliran: "ABU", beratG: 5_000, terjadiPada: new Date(Date.now() - 30 * 3_600_000).toISOString() } }));
    const pr = data<{ prioritas: { sumber: string; acuan: string; catatan: string } | null }>(await panggil(prioritas, { jalur: "/", cookie: c.pengangkut, params: { id: d.tps2 } }));
    expect(pr.prioritas).toMatchObject({ sumber: "PRAKIRAAN", catatan: TEKS.R10_CATATAN });
    const mulai = new Date().toISOString();
    await jalankanCron("sepuluh-menit", new Date(), { jendela: `uji-t18-${randomUUID()}`, hanyaSerah: [] });
    // Berkas test lain boleh menyisipkan snapshot yang lebih baru di antara GET dan cron (acuan slot bisa berbeda);
    // yang wajib: ada prioritas PRAKIRAAN tercatat untuk TPS ini dengan slot sesudah test dimulai.
    const p = await satu<{ n: string }>(`SELECT count(*) AS n FROM prioritas_tercatat WHERE tps_id = $1 AND sumber = 'PRAKIRAAN' AND acuan >= $2`, [d.tps2, mulai]);
    expect(Number(p.n)).toBeGreaterThanOrEqual(1);

    expect(panggilanJaringan).not.toHaveBeenCalled();
  });
});
