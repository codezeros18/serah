import { describe, expect, it } from "vitest";
import type { StatusSerah } from "@serah/kontrak";
import { terapkanTransisi, type AksiTransisi, type GalatTransisi, type Pelaku, type SerahKini } from "../status";
import { terapkanBatch, type TerapkanSatu } from "./index";

// T17 versi murni — sinkron idempoten (aksi sama 2× → 1 efek) + transisi kedaluwarsa → DITOLAK TRANSISI_TIDAK_SAH.

const K1 = "6f1c2a8e-0b3d-4c5e-9f70-1a2b3c4d5e01";
const K2 = "6f1c2a8e-0b3d-4c5e-9f70-1a2b3c4d5e02";
const K3 = "6f1c2a8e-0b3d-4c5e-9f70-1a2b3c4d5e03";

type AksiTambah = { idempotencyKey: string; tambah: number };
const tambah: TerapkanSatu<AksiTambah, number, { total: number }, string> = (s, a) =>
  a.tambah < 0 ? { ok: false, galat: "NEGATIF" } : { ok: true, keadaan: s + a.tambah, hasil: { total: s + a.tambah } };

describe("terapkanBatch — dasar", () => {
  it("aksi sama 2× dalam satu batch → satu efek, respons sama", () => {
    const h = terapkanBatch([{ idempotencyKey: K1, tambah: 5 }, { idempotencyKey: K1, tambah: 5 }], { keadaan: 0, tercatat: new Map() }, tambah);
    expect(h.keadaan).toBe(5);
    expect(h.hasil).toEqual([
      { idempotencyKey: K1, status: "DITERAPKAN", hasil: { total: 5 } },
      { idempotencyKey: K1, status: "DUPLIKAT", hasil: { total: 5 } },
    ]);
    expect([...h.tercatatBaru.keys()]).toEqual([K1]);
  });
  it("kunci yang sudah tercatat dari kiriman sebelumnya → DUPLIKAT dengan respons tersimpan, tanpa efek", () => {
    const tercatat = new Map([[K1, { total: 5 }]]);
    const h = terapkanBatch([{ idempotencyKey: K1, tambah: 5 }], { keadaan: 5, tercatat }, tambah);
    expect(h.keadaan).toBe(5);
    expect(h.hasil).toEqual([{ idempotencyKey: K1, status: "DUPLIKAT", hasil: { total: 5 } }]);
    expect(h.tercatatBaru.size).toBe(0);
  });
  it("DITOLAK tidak dicatat sehingga kiriman ulang dinilai ulang", () => {
    const h = terapkanBatch([{ idempotencyKey: K1, tambah: -1 }, { idempotencyKey: K2, tambah: 2 }], { keadaan: 0, tercatat: new Map() }, tambah);
    expect(h.hasil).toEqual([
      { idempotencyKey: K1, status: "DITOLAK", galat: "NEGATIF" },
      { idempotencyKey: K2, status: "DITERAPKAN", hasil: { total: 2 } },
    ]);
    expect(h.tercatatBaru.has(K1)).toBe(false);
  });
  it("urutan hasil = urutan kiriman; masukan tidak diubah", () => {
    const tercatat: ReadonlyMap<string, { total: number }> = new Map();
    const batch = Object.freeze([{ idempotencyKey: K3, tambah: 1 }, { idempotencyKey: K1, tambah: 1 }, { idempotencyKey: K2, tambah: 1 }]);
    const h = terapkanBatch(batch, { keadaan: 0, tercatat }, tambah);
    expect(h.hasil.map((x) => x.idempotencyKey)).toEqual([K3, K1, K2]);
    expect(tercatat.size).toBe(0);
  });
  it("batch kosong", () => {
    expect(terapkanBatch([], { keadaan: 7, tercatat: new Map() }, tambah)).toEqual({ hasil: [], keadaan: 7, tercatatBaru: new Map() });
  });
});

// ── Dengan mesin status ────────────────────────────────────────────────────

const SEKARANG = new Date("2026-10-15T05:00:00.000Z");
const pengangkut: Pelaku = { peran: "PENGANGKUT", orgIds: ["orgA"] };
const penerima: Pelaku = { peran: "PENERIMA", orgIds: ["orgP"] };

type AksiSerah = { idempotencyKey: string; kode: string; pelaku: Pelaku; aksi: AksiTransisi };
type Keadaan = ReadonlyMap<string, SerahKini>;
type Respons = { kode: string; status: StatusSerah; versi: number };

const terapkanSerah: TerapkanSatu<AksiSerah, Keadaan, Respons, GalatTransisi> = (keadaan, a) => {
  const s = keadaan.get(a.kode) ?? null;
  const konteks = {
    pelaku: a.pelaku,
    foto: { id: "foto1", jenis: "MUATAN" as const, organisasiId: "orgA", r04Lolos: true },
    kendaraan: { id: "kend1", organisasiId: "orgA", aktif: true },
    aturan: [],
  };
  const h = terapkanTransisi(s, a.aksi, konteks, SEKARANG);
  if (!h.ok || !s) return { ok: false, galat: h.ok ? { kode: "TIDAK_DITEMUKAN", sebab: "STATUS_TIDAK_COCOK" } : h.galat };
  const baru = new Map(keadaan);
  baru.set(a.kode, { ...s, ...h.proyeksi, status: h.statusBaru, versi: h.versiBaru, aliran: h.proyeksi.aliran ?? s.aliran });
  return { ok: true, keadaan: baru, hasil: { kode: a.kode, status: h.statusBaru, versi: h.versiBaru } };
};

const serahAwal = (status: StatusSerah): SerahKini => ({
  kode: "SRH-20261015-0001",
  status,
  versi: 2,
  tpsId: "tps1",
  orgKawasanId: "orgK",
  orgPengangkutId: status === "DRAF" ? null : "orgA",
  orgPenerimaId: status === "DRAF" ? null : "orgP",
  aliran: ["KUNING"],
});

describe("T17 murni: sinkron idempoten dengan terapkanTransisi", () => {
  const ambil = (k: string): AksiSerah => ({
    idempotencyKey: k,
    kode: "SRH-20261015-0001",
    pelaku: pengangkut,
    aksi: { jenis: "AMBIL", fotoId: "foto1", kendaraanId: "kend1", penerimaId: "orgP" },
  });
  const tutup = (k: string): AksiSerah => ({
    idempotencyKey: k,
    kode: "SRH-20261015-0001",
    pelaku: penerima,
    aksi: { jenis: "TUTUP_TERIMA", tiket: { beratG: 10_000, sumber: "MANUAL" }, rincian: [{ aliran: "KUNING", diterimaG: 10_000, ditolakG: 0 }] },
  });

  it("AMBIL terkirim 2× (antrean offline mengulang) → satu efek; versi naik sekali", () => {
    const awal = new Map([["SRH-20261015-0001", serahAwal("DRAF")]]);
    const h = terapkanBatch([ambil(K1), ambil(K1)], { keadaan: awal, tercatat: new Map() }, terapkanSerah);
    expect(h.hasil.map((x) => x.status)).toEqual(["DITERAPKAN", "DUPLIKAT"]);
    expect(h.keadaan.get("SRH-20261015-0001")).toMatchObject({ status: "MENUNGGU_SETUJU", versi: 3 });
    expect(h.hasil[1]).toEqual({ idempotencyKey: K1, status: "DUPLIKAT", hasil: { kode: "SRH-20261015-0001", status: "MENUNGGU_SETUJU", versi: 3 } });
  });

  it("transisi kedaluwarsa (serah sudah diambil pihak lain) → DITOLAK TRANSISI_TIDAK_SAH", () => {
    const awal = new Map([["SRH-20261015-0001", serahAwal("MENUNGGU_SETUJU")]]);
    const h = terapkanBatch([ambil(K2)], { keadaan: awal, tercatat: new Map() }, terapkanSerah);
    expect(h.hasil).toEqual([{ idempotencyKey: K2, status: "DITOLAK", galat: { kode: "TRANSISI_TIDAK_SAH", sebab: "STATUS_TIDAK_COCOK" } }]);
    expect(h.keadaan).toBe(awal);
  });

  it("TUTUP diulang dengan kunci sama → DUPLIKAT; TUTUP kunci baru atas serah tertutup → DITOLAK", () => {
    const awal = new Map([["SRH-20261015-0001", serahAwal("DIANGKUT")]]);
    const h = terapkanBatch([tutup(K1), tutup(K1), tutup(K3)], { keadaan: awal, tercatat: new Map() }, terapkanSerah);
    expect(h.hasil.map((x) => x.status)).toEqual(["DITERAPKAN", "DUPLIKAT", "DITOLAK"]);
    expect(h.hasil[2]).toMatchObject({ galat: { kode: "TRANSISI_TIDAK_SAH" } });
    expect(h.keadaan.get("SRH-20261015-0001")?.status).toBe("DITERIMA");
  });

  it("kiriman kedua (batch baru) dengan kunci tercatat → respons sama, keadaan tetap", () => {
    const awal = new Map([["SRH-20261015-0001", serahAwal("DRAF")]]);
    const pertama = terapkanBatch([ambil(K1)], { keadaan: awal, tercatat: new Map() }, terapkanSerah);
    const kedua = terapkanBatch([ambil(K1)], { keadaan: pertama.keadaan, tercatat: pertama.tercatatBaru }, terapkanSerah);
    expect(kedua.hasil[0]).toEqual({ ...pertama.hasil[0], status: "DUPLIKAT" });
    expect(kedua.keadaan).toBe(pertama.keadaan);
  });
});
