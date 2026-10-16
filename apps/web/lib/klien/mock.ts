// Mock API (S04-7). Aktif bila NEXT_PUBLIC_API_MOCK=true. Meniru BLUEPRINT §K.2 dengan data seed §H.5
// (nama berlabel contoh). Keluaran divalidasi terhadap skema kontrak oleh mock.test.ts.
// Jalur B memakai mock sampai rute nyata MERGED; saat itu mock untuk rute tersebut dimatikan (CLAUDE.md §8.2).
import type { z } from "zod";
import type { Aliran, Peran, StatusSerah } from "@serah/kontrak/enum";
import type { Galat, KodeGalat } from "@serah/kontrak/galat";
import type {
  SerahTimelineEvent as SkemaTimeline,
  SerahRingkas as SkemaRingkas,
  SerahWadah as SkemaWadah,
  RincianPenutupan as SkemaRincian,
  SerahTutupMasukan,
} from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import type { HasilApi, OpsiMentah } from "./api";
import { formatGramKeKg } from "./angka";
import {
  ALIRAN_SEMUA,
  ANGGOTA,
  KAWASAN,
  KENDARAAN,
  KONTRAK,
  MITRA,
  ORG,
  ORGANISASI,
  PAKET,
  TPS_DAFTAR,
  hash64,
  idm,
  notifikasiContoh,
  tagihanContoh,
  teksR10Prakiraan,
} from "./mock-data";

type Timeline = z.infer<typeof SkemaTimeline>;
type Ringkas = z.infer<typeof SkemaRingkas>;
type WadahSerah = z.infer<typeof SkemaWadah>;
type Rincian = z.infer<typeof SkemaRincian>;
type MasukanTutup = z.infer<typeof SerahTutupMasukan>;

export class GalatMock extends Error {
  constructor(
    readonly kode: KodeGalat,
    pesan: string = kode,
    readonly aturan?: Galat["aturan"],
  ) {
    super(pesan);
  }
}

type Konteks = {
  params: Record<string, string>;
  kueri: Record<string, unknown>;
  body: Record<string, unknown>;
  sekarang: number;
};
type Handler = (c: Konteks) => unknown;

// ── Peran sesi mock ─────────────────────────────────────────────────────────

const KUNCI_PERAN = "serah.mock.peran";
const DARI_SEGMEN: Record<string, Peran> = {
  petugas: "PETUGAS",
  pengangkut: "PENGANGKUT",
  kawasan: "PENGELOLA",
  penerima: "PENERIMA",
  admin: "ADMIN",
};
let peranDipaksa: Peran | null = null;

/** Untuk test & halaman uji: paksa peran sesi mock. */
export function aturPeranMock(peran: Peran | null): void {
  peranDipaksa = peran;
  try {
    if (typeof sessionStorage !== "undefined") {
      if (peran) sessionStorage.setItem(KUNCI_PERAN, peran);
      else sessionStorage.removeItem(KUNCI_PERAN);
    }
  } catch {
    /* penyimpanan tidak tersedia: abaikan */
  }
}

/** Peran mock: dipaksa → ?peran= → segmen rute (disimpan) → tersimpan sesi → PENGELOLA. */
export function peranMock(): Peran {
  if (peranDipaksa) return peranDipaksa;
  if (typeof window === "undefined") return "PENGELOLA";
  let hasil: Peran | null = null;
  try {
    const q = new URLSearchParams(window.location.search).get("peran")?.toUpperCase();
    if (q && q in PERAN_VALID) hasil = q as Peran;
    const panel = new URLSearchParams(window.location.search).get("panel")?.toLowerCase();
    if (panel && panel in DARI_SEGMEN) hasil = DARI_SEGMEN[panel] ?? null;
    hasil ??= DARI_SEGMEN[window.location.pathname.split("/")[1] ?? ""] ?? null;
    if (hasil) {
      sessionStorage.setItem(KUNCI_PERAN, hasil);
      return hasil;
    }
    const tersimpan = sessionStorage.getItem(KUNCI_PERAN);
    if (tersimpan && tersimpan in PERAN_VALID) return tersimpan as Peran;
  } catch {
    /* penyimpanan tidak tersedia: abaikan */
  }
  return hasil ?? "PENGELOLA";
}
const PERAN_VALID: Record<Peran, true> = { PETUGAS: true, PENGELOLA: true, PENGANGKUT: true, PENERIMA: true, ADMIN: true };

function orgPeran(peran: Peran) {
  const id =
    peran === "PENGANGKUT" ? ORG.pengangkut : peran === "PENERIMA" ? ORG.daurUlang : peran === "ADMIN" ? ORG.internal : ORG.kawasan;
  const o = ORGANISASI.find((x) => x.id === id);
  if (!o) throw new Error("organisasi mock tidak ada");
  return o;
}

function sesiRingkas(peran: Peran) {
  const o = orgPeran(peran);
  return { organisasi: [{ id: o.id, nama: o.nama, jenis: o.jenis, peran: [peran] }], peranAktif: peran };
}

function sesiPenuh(peran: Peran) {
  const o = orgPeran(peran);
  return {
    pengguna: { id: idm("pgn", PERAN_URUTAN[peran]) },
    organisasiAktif: { id: o.id, kode: o.kode, nama: o.nama, jenis: o.jenis },
    peran,
    paket: peran === "PENGELOLA" || peran === "PETUGAS" ? PAKET[0]?.kode ?? null : null,
    // Skenario uji "tanpaHak": paket tanpa hak berbayar (uji G_HAK_PAKET).
    hak: skenario("tanpaHak") === "1" ? [] : (PAKET[0]?.hak ?? []),
  };
}
const PERAN_URUTAN: Record<Peran, number> = { PETUGAS: 1, PENGELOLA: 2, PENGANGKUT: 3, PENERIMA: 4, ADMIN: 5 };

/** Skenario uji (e2e): kunci sessionStorage → nilai. Tanpa penyimpanan → null. */
function skenario(kunci: string): string | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(`serah.mock.${kunci}`);
  } catch {
    return null;
  }
}

// ── Keadaan mock (dalam memori; hilang saat muat ulang) ─────────────────────

type SerahState = {
  kode: string;
  status: StatusSerah;
  versi: number;
  tpsIdx: number;
  aliran: Aliran[];
  wadahIds: string[];
  jamLalu: number;
  rincian: Rincian[];
  tiket: { nomor: string | null; beratG: number } | null;
  penerimaId: string | null;
  kendaraanId: string | null;
};

const state = {
  serah: [] as SerahState[],
  wadah: [] as Array<{ id: string; tpsIdx: number; aliran: Aliran; beratG: number | null; jumlahWadah: number | null; jamLalu: number; serah: string | null }>,
  notifDibaca: new Set<string>(),
  kendaraan: KENDARAAN.map((k) => ({ ...k })),
  tps: TPS_DAFTAR.map((t) => ({ ...t })),
  kontrak: KONTRAK.map((k) => ({ ...k })),
  anggota: ANGGOTA.map((a) => ({ ...a })),
  tagihan: tagihanContoh(),
  urutSerah: 7,
  urutLain: 100,
  kunciTerapan: new Set<string>(),
  diinisialisasi: false,
};

function tanggalWib(ms: number): string {
  return new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
}
function kodeSerah(ms: number, n: number): string {
  return `SRH-${tanggalWib(ms).replace(/-/g, "")}-${String(n).padStart(4, "0")}`;
}
function iso(ms: number, jamLalu = 0): string {
  return new Date(ms - jamLalu * 3_600_000).toISOString();
}

function inisialisasi(sekarang: number): void {
  if (state.diinisialisasi) return;
  state.diinisialisasi = true;
  const w = (n: number, tpsIdx: number, aliran: Aliran, beratG: number | null, jumlahWadah: number | null, jamLalu: number, serah: string | null) => ({
    id: idm("wdh", n), tpsIdx, aliran, beratG, jumlahWadah, jamLalu, serah,
  });
  // Wadah menunggu (belum di serah)
  state.wadah.push(
    w(1, 0, "HIJAU", 12_500, null, 6, null),
    w(2, 0, "KUNING", 42_500, null, 30, null),
    w(3, 0, "ABU", 80_000, null, 10, null),
    w(4, 0, "MERAH", null, 2, 5, null),
    w(5, 1, "HIJAU", 20_000, null, 26, null),
    w(6, 1, "KUNING", 15_000, null, 8, null),
  );
  const daftar: Array<[StatusSerah, number, Aliran[], number]> = [
    ["DRAF", 0, ["KUNING"], 2],
    ["MENUNGGU_SETUJU", 0, ["KUNING"], 5],
    ["DIANGKUT", 1, ["KUNING"], 8],
    ["DITERIMA", 0, ["ABU"], 30],
    ["DITERIMA_SEBAGIAN", 1, ["KUNING"], 50],
    ["DITOLAK", 0, ["KUNING"], 70],
    ["MENGGANTUNG", 1, ["ABU"], 20],
  ];
  daftar.forEach(([status, tpsIdx, aliran, jamLalu], i) => {
    const n = i + 1;
    const wadahIds = aliran.map((a, j) => {
      const id = idm("wds", n * 10 + j);
      state.wadah.push({ id, tpsIdx, aliran: a, beratG: 30_000, jumlahWadah: null, jamLalu: jamLalu + 4, serah: kodeSerah(sekarang, n) });
      return id;
    });
    const tutup = status === "DITERIMA" || status === "DITERIMA_SEBAGIAN" || status === "DITOLAK";
    const rincian: Rincian[] = tutup
      ? aliran.map((a, j) => {
          const diterima = status === "DITERIMA" ? 30_000 : status === "DITERIMA_SEBAGIAN" ? 22_000 : 0;
          const ditolak = 30_000 - diterima;
          return {
            id: idm("rnc", n * 10 + j),
            aliran: a,
            diterimaG: diterima,
            ditolakG: ditolak,
            alasan: ditolak > 0 ? "BASAH_KOTOR" : null,
            keterangan: null,
            diterimaFinalG: diterima,
            ditolakFinalG: ditolak,
          };
        })
      : [];
    state.serah.push({
      kode: kodeSerah(sekarang, n),
      status,
      versi: 1,
      tpsIdx,
      aliran,
      wadahIds,
      jamLalu,
      rincian,
      tiket: tutup ? { nomor: `TKT-CONTOH-${n}`, beratG: aliran.length * 30_000 } : null,
      penerimaId: status === "DRAF" ? null : ORG.daurUlang,
      kendaraanId: status === "DRAF" ? null : idm("knd", 1),
    });
  });
}

// ── Pembangun respons ───────────────────────────────────────────────────────

function cariSerah(kode: string | undefined): SerahState {
  const s = state.serah.find((x) => x.kode === kode);
  if (!s) throw new GalatMock("TIDAK_DITEMUKAN");
  return s;
}

function ringkas(s: SerahState, sekarang: number): Ringkas {
  const t = state.tps[s.tpsIdx];
  if (!t) throw new Error("TPS mock tidak ada");
  return {
    kode: s.kode,
    status: s.status,
    versi: s.versi,
    tps: { id: t.id, kode: t.kode, nama: t.nama },
    kawasan: { id: KAWASAN.id, nama: KAWASAN.nama },
    aliran: s.aliran,
    dibuatPada: iso(sekarang, s.jamLalu + 4),
    diperbaruiPada: iso(sekarang, s.jamLalu),
  };
}

const PERAN_EVENT: Record<string, Peran> = {
  SERAH_DIBUAT: "PETUGAS",
  SERAH_DIAMBIL: "PENGANGKUT",
  SERAH_DISETUJUI: "PENGELOLA",
  SERAH_DITERIMA: "PENERIMA",
};

function timeline(s: SerahState, sekarang: number): Timeline[] {
  const urut: Array<Timeline["jenis"]> = ["SERAH_DIBUAT"];
  if (s.status !== "DRAF") urut.push("SERAH_DIAMBIL");
  if (["DIANGKUT", "MENGGANTUNG", "DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"].includes(s.status)) urut.push("SERAH_DISETUJUI");
  if (s.status === "DITERIMA") urut.push("SERAH_DITERIMA");
  if (s.status === "DITERIMA_SEBAGIAN") urut.push("SERAH_DITERIMA_SEBAGIAN");
  if (s.status === "DITOLAK") urut.push("SERAH_DITOLAK");
  if (s.status === "MENGGANTUNG") urut.push("SERAH_MENGGANTUNG");
  return urut.map((jenis, i) => ({
    urutanRantai: i + 1,
    jenis,
    peran: PERAN_EVENT[jenis] ?? "PENERIMA",
    terjadiPada: iso(sekarang, s.jamLalu + (urut.length - i)),
    diterimaPada: iso(sekarang, s.jamLalu + (urut.length - i)),
    hash: hash64(Number.parseInt(s.kode.slice(-4), 10) * 100 + i + 1),
  }));
}

function detail(s: SerahState, sekarang: number) {
  const wadah: WadahSerah[] = s.wadahIds.map((id, i) => ({
    id,
    aliran: s.aliran[i] ?? "KUNING",
    beratG: 30_000,
    jumlahWadah: null,
    terjadiPada: iso(sekarang, s.jamLalu + 4),
  }));
  const penerima = s.penerimaId ? ORGANISASI.find((x) => x.id === s.penerimaId) : undefined;
  const kendaraan = state.kendaraan.find((k) => k.id === s.kendaraanId);
  return {
    ...ringkas(s, sekarang),
    pengangkut: s.status === "DRAF" ? null : { id: ORG.pengangkut, nama: "PT Angkut Bersih Nusantara" },
    penerima: penerima ? { id: penerima.id, nama: penerima.nama } : null,
    kendaraan: kendaraan ? { id: kendaraan.id, plat: kendaraan.plat } : null,
    wadah,
    timeline: timeline(s, sekarang),
    foto:
      s.status === "DRAF"
        ? []
        : [{ id: idm("fto", 900), jenis: "MUATAN" as const, url: "/ikon/ikon.svg", kedaluwarsaPada: iso(sekarang, -1) }],
    tiket: s.tiket
      ? {
          id: idm("tkt", Number.parseInt(s.kode.slice(-4), 10)),
          fotoId: null,
          nomor: s.tiket.nomor,
          beratG: s.tiket.beratG,
          sumber: "MANUAL" as const,
          aiModel: null,
          aiKeyakinan: null,
          beratFinalG: s.tiket.beratG,
        }
      : null,
    rincian: s.rincian,
  };
}

function totalAliran(sekarang: number, hari: boolean) {
  return ALIRAN_SEMUA.map((aliran) => {
    const baris = state.serah.filter(
      (s) => s.aliran.includes(aliran) && ["DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"].includes(s.status) && (!hari || s.jamLalu < 24),
    );
    const beratTpsG = baris.length * 30_000;
    const beratDiterimaG = baris.reduce((j, s) => j + (s.rincian.find((r) => r.aliran === aliran)?.diterimaG ?? 0), 0);
    void sekarang;
    return { aliran, beratTpsG, beratDiterimaG, beratDitolakG: beratTpsG - beratDiterimaG };
  });
}

function barisLaporan(sekarang: number) {
  return state.serah
    .filter((s) => s.rincian.length > 0)
    .flatMap((s) =>
      s.rincian.map((r) => {
        const t = state.tps[s.tpsIdx];
        const penerima = ORGANISASI.find((x) => x.id === s.penerimaId);
        return {
          tanggalWib: tanggalWib(sekarang - s.jamLalu * 3_600_000),
          kodeSerah: s.kode,
          aliran: r.aliran,
          beratTpsG: r.diterimaG + r.ditolakG,
          beratDiterimaG: r.diterimaG,
          beratDitolakG: r.ditolakG,
          alasanTolak: r.alasan,
          tpsKode: t?.kode ?? "TPS-PCS-01",
          kawasanNama: KAWASAN.nama,
          kawasanAlamat: KAWASAN.alamat,
          pengangkutNama: "PT Angkut Bersih Nusantara",
          plat: "B 9001 SRH",
          penerimaNama: penerima?.nama ?? null,
          penerimaJenis: penerima?.jenisPenerima ?? null,
          status: s.status,
          sidikEvent: hash64(Number.parseInt(s.kode.slice(-4), 10) * 100 + 9),
        };
      }),
    );
}

function periodeDari(kueri: Record<string, unknown>, sekarang: number): string {
  return typeof kueri.periode === "string" ? kueri.periode : tanggalWib(sekarang).slice(0, 7);
}

function sudahTutup(): number {
  return state.serah.filter((s) => s.rincian.length > 0).length;
}

function tpsDari(id: string | undefined) {
  const t = state.tps.find((x) => x.id === id);
  if (!t) throw new GalatMock("TIDAK_DITEMUKAN");
  return t;
}

function terapkanTutup(s: SerahState, m: MasukanTutup): StatusSerah {
  s.tiket = { nomor: m.tiket.nomor ?? null, beratG: m.tiket.beratG };
  s.rincian = m.rincian.map((r, i) => ({
    id: idm("rnc", s.versi * 100 + i),
    aliran: r.aliran,
    diterimaG: r.diterimaG,
    ditolakG: r.ditolakG,
    alasan: r.alasan ?? null,
    keterangan: r.keterangan ?? null,
    diterimaFinalG: r.diterimaG,
    ditolakFinalG: r.ditolakG,
  }));
  const diterima = s.rincian.reduce((j, r) => j + r.diterimaG, 0);
  const ditolak = s.rincian.reduce((j, r) => j + r.ditolakG, 0);
  return ditolak === 0 ? "DITERIMA" : diterima === 0 ? "DITOLAK" : "DITERIMA_SEBAGIAN";
}

const ok = { ok: true } as const;

// ── Peta rute ───────────────────────────────────────────────────────────────

const HANDLER: Record<string, Handler> = {
  // Auth & sesi
  "POST /api/auth/daftar": () => ({ perluVerifikasi: true }),
  "POST /api/auth/verifikasi": () => ok,
  "POST /api/auth/masuk": () => ({ sesi: sesiRingkas(peranMock()) }),
  "POST /api/auth/keluar": () => ok,
  "POST /api/auth/lupa": () => ok,
  "POST /api/auth/reset": () => ok,
  "POST /api/auth/demo": (c) => ({ sesi: sesiRingkas((c.body.peran as Peran | undefined) ?? peranMock()) }),
  "GET /api/sesi": () => sesiPenuh(peranMock()),
  "POST /api/sesi/organisasi": (c) => sesiPenuh((c.body.peran as Peran | undefined) ?? peranMock()),

  // Akun
  "GET /api/akun/data-saya": (c) => ({
    pengguna: { id: idm("pgn", 1), email: "contoh@demo.serah.id", emailTerverifikasiPada: iso(c.sekarang, 700), dibuatPada: iso(c.sekarang, 720) },
    keanggotaan: [
      { organisasiId: orgPeran(peranMock()).id, organisasiNama: orgPeran(peranMock()).nama, peran: peranMock(), pengurus: true, aktif: true, sejak: iso(c.sekarang, 700) },
    ],
    persetujuan: [{ versi: "1.0", jenis: "LAYANAN", pada: iso(c.sekarang, 720) }],
    preferensiNotifikasi: [{ organisasiId: orgPeran(peranMock()).id, email: true, push: false }],
    langgananPush: [],
  }),
  "POST /api/akun/tarik-persetujuan": () => ok,
  "POST /api/akun/hapus": () => ok,
  "GET /api/akun/notifikasi": () => ({ preferensi: [{ organisasiId: orgPeran(peranMock()).id, email: true, push: false }] }),
  "PUT /api/akun/notifikasi": (c) => ({
    preferensi: [{ organisasiId: String(c.body.organisasiId), email: Boolean(c.body.email), push: Boolean(c.body.push) }],
  }),

  // Organisasi, izin, undangan, anggota
  "POST /api/organisasi": (c) => ({
    organisasi: { ...orgPeran("PENGELOLA"), id: idm("org", 50), nama: String(c.body.nama ?? "Organisasi contoh") },
  }),
  "GET /api/organisasi/saya": () => ({ organisasi: orgPeran(peranMock()) }),
  "PATCH /api/organisasi/saya": (c) => ({ organisasi: { ...orgPeran(peranMock()), nama: String(c.body.nama ?? orgPeran(peranMock()).nama) } }),
  "POST /api/organisasi/izin": () => ({ statusIzin: "MENUNGGU" }),
  "POST /api/undangan": (c) => ({ kadaluwarsaPada: iso(c.sekarang, -168) }),
  "POST /api/undangan/terima": () => ({ organisasiId: ORG.kawasan, peran: "PETUGAS" }),
  "GET /api/anggota": () => ({ anggota: state.anggota }),
  "POST /api/anggota/[id]/nonaktif": (c) => {
    const a = state.anggota.find((x) => x.id === c.params.id);
    if (!a) throw new GalatMock("TIDAK_DITEMUKAN");
    a.aktif = false;
    return { id: a.id, aktif: false };
  },

  // Kawasan
  "POST /api/kawasan": (c) => ({ kawasan: { ...KAWASAN, id: idm("kws", 50), nama: String(c.body.nama ?? KAWASAN.nama) } }),
  "GET /api/kawasan": () => ({ kawasan: [KAWASAN] }),
  "PATCH /api/kawasan/[id]": (c) => ({ kawasan: { ...KAWASAN, ...(typeof c.body.nama === "string" ? { nama: c.body.nama } : {}) } }),

  // TPS
  "POST /api/tps": (c) => {
    const n = state.tps.length + 1;
    const t = {
      id: idm("tps", n),
      kawasanId: KAWASAN.id,
      kode: `TPS-PCS-${String(n).padStart(2, "0")}`,
      nama: String(c.body.nama ?? "TPS baru (contoh)"),
      latE6: Number(c.body.latE6 ?? -6_160_000),
      lonE6: Number(c.body.lonE6 ?? 106_850_000),
      aktif: true,
      qrVersi: 1,
    };
    state.tps.push(t);
    return { tps: t };
  },
  "GET /api/tps": () => ({ tps: state.tps }),
  "PATCH /api/tps/[id]": (c) => {
    const t = tpsDari(c.params.id);
    if (typeof c.body.nama === "string") t.nama = c.body.nama;
    if (typeof c.body.aktif === "boolean") t.aktif = c.body.aktif;
    return { tps: t };
  },
  "POST /api/tps/[id]/qr-baru": (c) => {
    const t = tpsDari(c.params.id);
    t.qrVersi += 1;
    return { qrVersi: t.qrVersi, qrToken: `mocktokentps${t.kode}v${t.qrVersi}`.toLowerCase().padEnd(24, "x") };
  },
  "GET /api/tps/[id]/qr": () => "",
  "GET /api/tps/qr/[token]": (c) => {
    const t = state.tps.find((x) => c.params.token?.includes(x.kode.toLowerCase())) ?? state.tps[0];
    if (!t) throw new GalatMock("TIDAK_DITEMUKAN");
    return { tps: { id: t.id, kode: t.kode, nama: t.nama }, kawasan: { id: KAWASAN.id, kode: KAWASAN.kode, nama: KAWASAN.nama } };
  },

  // Kendaraan
  "POST /api/kendaraan": (c) => {
    const k = { id: idm("knd", state.kendaraan.length + 1), plat: String(c.body.plat ?? "B 9003 SRH"), aktif: true };
    state.kendaraan.push(k);
    return { kendaraan: k };
  },
  "GET /api/kendaraan": () => ({ kendaraan: state.kendaraan }),
  "POST /api/kendaraan/[id]/nonaktif": (c) => {
    const k = state.kendaraan.find((x) => x.id === c.params.id);
    if (!k) throw new GalatMock("TIDAK_DITEMUKAN");
    k.aktif = false;
    return { kendaraan: k };
  },

  // Kontrak & direktori
  "GET /api/direktori/mitra": (c) => ({ mitra: c.kueri.jenis ? MITRA.filter((m) => m.jenis === c.kueri.jenis) : MITRA }),
  "POST /api/kontrak": (c) => {
    const baru = {
      ...(state.kontrak[0] as (typeof state.kontrak)[number]),
      id: idm("ktr", state.kontrak.length + 1),
      status: "USULAN" as const,
      dikonfirmasiPengangkutPada: null,
      dikonfirmasiPenerimaPada: null,
      aliran: (c.body.aliran as Aliran[] | undefined) ?? ["KUNING"],
    };
    state.kontrak.push(baru);
    return { kontrak: baru };
  },
  "POST /api/kontrak/[id]/konfirmasi": (c) => {
    const k = state.kontrak.find((x) => x.id === c.params.id);
    if (!k) throw new GalatMock("TIDAK_DITEMUKAN");
    k.status = "AKTIF";
    k.dikonfirmasiPenerimaPada = iso(c.sekarang);
    return { kontrak: k };
  },
  "POST /api/kontrak/[id]/akhiri": (c) => {
    const k = state.kontrak.find((x) => x.id === c.params.id);
    if (!k) throw new GalatMock("TIDAK_DITEMUKAN");
    k.status = "BERAKHIR";
    return { kontrak: k };
  },
  "GET /api/kontrak": (c) => ({ kontrak: c.kueri.status ? state.kontrak.filter((k) => k.status === c.kueri.status) : state.kontrak }),

  // Wadah
  "POST /api/wadah": (c) => {
    const t = tpsDari(String(c.body.tpsId));
    const idx = state.tps.indexOf(t);
    const id = idm("wdh", state.wadah.length + 1);
    state.wadah.push({
      id,
      tpsIdx: idx,
      aliran: c.body.aliran as Aliran,
      beratG: typeof c.body.beratG === "number" ? c.body.beratG : null,
      jumlahWadah: typeof c.body.jumlahWadah === "number" ? c.body.jumlahWadah : null,
      jamLalu: 0,
      serah: null,
    });
    return { id, diterimaPada: iso(c.sekarang) };
  },
  "GET /api/tps/[id]/menunggu": (c) => {
    const t = tpsDari(c.params.id);
    const idx = state.tps.indexOf(t);
    const wadah = state.wadah
      .filter((w) => w.tpsIdx === idx && w.serah === null)
      .map((w) => ({
        id: w.id,
        aliran: w.aliran,
        beratG: w.beratG,
        jumlahWadah: w.jumlahWadah,
        terjadiPada: iso(c.sekarang, w.jamLalu),
        umurJam: w.jamLalu,
      }));
    const lewat = wadah.find((w) => w.aliran === "HIJAU" && w.umurJam > 24);
    return {
      wadah,
      peringatan: lewat
        ? [{ kode: "R06" as const, aksi: "PERINGATAN" as const, teks: isi("ATURAN_R06", { kode_tps: t.kode, jam: lewat.umurJam }) }]
        : [],
    };
  },

  // Serah
  "POST /api/serah": (c) => {
    const t = tpsDari(String(c.body.tpsId));
    const ids = (c.body.wadahIds as string[] | undefined) ?? [];
    const terpilih = state.wadah.filter((w) => ids.includes(w.id) && w.serah === null);
    if (terpilih.length === 0) throw new GalatMock("VALIDASI_GAGAL");
    state.urutSerah += 1;
    const kode = kodeSerah(c.sekarang, state.urutSerah);
    terpilih.forEach((w) => {
      w.serah = kode;
    });
    state.serah.push({
      kode,
      status: "DRAF",
      versi: 1,
      tpsIdx: state.tps.indexOf(t),
      aliran: [...new Set(terpilih.map((w) => w.aliran))],
      wadahIds: terpilih.map((w) => w.id),
      jamLalu: 0,
      rincian: [],
      tiket: null,
      penerimaId: null,
      kendaraanId: null,
    });
    return { kode, qrToken: kode };
  },
  "GET /api/serah/[kode]": (c) => detail(cariSerah(c.params.kode), c.sekarang),
  "GET /api/serah": (c) => ({
    serah: state.serah
      .filter((s) => (c.kueri.status ? s.status === c.kueri.status : true))
      .map((s) => ringkas(s, c.sekarang)),
  }),
  "GET /api/ambil": () => ({
    serah: state.serah
      .filter((s) => s.status === "DRAF")
      .map((s) => {
        const t = state.tps[s.tpsIdx] ?? TPS_DAFTAR[0];
        if (!t) throw new Error("TPS mock tidak ada");
        const tua = Math.max(s.jamLalu + 4, 30);
        return {
          kode: s.kode,
          tps: { id: t.id, kode: t.kode, nama: t.nama },
          kawasan: { id: KAWASAN.id, nama: KAWASAN.nama },
          aliran: s.aliran,
          umurJamTertua: tua,
          prioritas: s.aliran.includes("KUNING") ? { sumber: "PRAKIRAAN" as const, teks: teksR10Prakiraan(tua) } : undefined,
        };
      }),
  }),
  "POST /api/serah/[kode]/ambil": (c) => {
    const s = cariSerah(c.params.kode);
    if (s.status !== "DRAF") throw new GalatMock("TRANSISI_TIDAK_SAH");
    const penerima = ORGANISASI.find((x) => x.id === c.body.penerimaId);
    if (penerima?.statusIzin !== undefined && penerima.statusIzin !== "TERVERIFIKASI") {
      throw new GalatMock("ATURAN_DITOLAK", "R11", { kode: "R11", aksi: "TOLAK", teks: TEKS.ATURAN_R11 });
    }
    if (penerima?.jenisPenerima === "TPA_TPST" && s.aliran.some((a) => a !== "ABU")) {
      throw new GalatMock("ATURAN_DITOLAK", "R01", {
        kode: "R01",
        aksi: "TOLAK",
        teks: isi("ATURAN_R01", { aliran: s.aliran.filter((a) => a !== "ABU").join(", ") }),
      });
    }
    if (penerima) {
      const kurang = s.aliran.filter((a) => !penerima.aliranDiterima.includes(a));
      if (kurang.length > 0) {
        throw new GalatMock("ATURAN_DITOLAK", "R03", {
          kode: "R03",
          aksi: "TOLAK",
          teks: isi("ATURAN_R03", { aliran: kurang.join(", ") }),
        });
      }
      const tanpaKontrak = s.aliran.filter(
        (a) => !state.kontrak.some((k) => k.status === "AKTIF" && k.penerima.id === penerima.id && k.aliran.includes(a)),
      );
      if (tanpaKontrak.length > 0) {
        throw new GalatMock("ATURAN_DITOLAK", "R02", {
          kode: "R02",
          aksi: "TOLAK",
          teks: isi("ATURAN_R02", { aliran: tanpaKontrak.join(", ") }),
        });
      }
    }
    s.status = "MENUNGGU_SETUJU";
    s.versi += 1;
    s.penerimaId = String(c.body.penerimaId);
    s.kendaraanId = String(c.body.kendaraanId);
    return { kode: s.kode, status: s.status, versi: s.versi };
  },
  "POST /api/serah/[kode]/setujui": (c) => {
    const s = cariSerah(c.params.kode);
    if (s.status !== "MENUNGGU_SETUJU") throw new GalatMock("TRANSISI_TIDAK_SAH");
    s.status = "DIANGKUT";
    s.versi += 1;
    return { kode: s.kode, status: s.status, versi: s.versi };
  },
  "POST /api/serah/[kode]/kembalikan": (c) => {
    const s = cariSerah(c.params.kode);
    if (s.status !== "MENUNGGU_SETUJU") throw new GalatMock("TRANSISI_TIDAK_SAH");
    s.status = "DRAF";
    s.versi += 1;
    return { kode: s.kode, status: s.status, versi: s.versi };
  },
  "POST /api/serah/[kode]/tutup": (c) => {
    const s = cariSerah(c.params.kode);
    if (s.status !== "DIANGKUT" && s.status !== "MENGGANTUNG") throw new GalatMock("TRANSISI_TIDAK_SAH");
    const beratTpsG = s.wadahIds.length * 30_000;
    s.status = terapkanTutup(s, c.body as unknown as MasukanTutup);
    s.versi += 1;
    // R-08 (tiruan sederhana): selisih tiket vs catatan TPS > 20% → peringatan, TIDAK menolak.
    const tiketG = s.tiket?.beratG ?? 0;
    const selisihPersen = Math.trunc((Math.abs(tiketG - beratTpsG) * 100) / beratTpsG);
    const peringatan =
      selisihPersen > 20
        ? [
            {
              kode: "R08" as const,
              aksi: "PERINGATAN" as const,
              teks: isi("ATURAN_R08", {
                berat_tiket: formatGramKeKg(tiketG),
                persen: selisihPersen,
                berat_tps: formatGramKeKg(beratTpsG),
              }),
            },
          ]
        : [];
    return { kode: s.kode, status: s.status, versi: s.versi, peringatan };
  },
  "POST /api/serah/[kode]/koreksi": (c) => {
    const s = cariSerah(c.params.kode);
    const perubahan = (c.body.perubahan as Array<{ target: string; targetId: string; nilaiFinalG: number }> | undefined) ?? [];
    if (perubahan.length === 0) throw new GalatMock("VALIDASI_GAGAL");
    const koreksi = perubahan.map((p) => {
      const r = s.rincian.find((x) => x.id === p.targetId);
      const asli = p.target === "TIKET" ? (s.tiket?.beratG ?? 0) : p.target === "RINCIAN_DITERIMA" ? (r?.diterimaG ?? 0) : (r?.ditolakG ?? 0);
      if (p.target === "TIKET" && s.tiket) s.tiket.beratG = p.nilaiFinalG;
      if (r && p.target === "RINCIAN_DITERIMA") r.diterimaFinalG = p.nilaiFinalG;
      if (r && p.target === "RINCIAN_DITOLAK") r.ditolakFinalG = p.nilaiFinalG;
      return {
        koreksiId: idm("krk", state.urutLain++),
        target: p.target as "TIKET" | "RINCIAN_DITERIMA" | "RINCIAN_DITOLAK",
        targetId: p.targetId,
        nilaiAsliG: asli,
        nilaiFinalG: p.nilaiFinalG,
      };
    });
    const [pertama] = koreksi;
    if (!pertama) throw new GalatMock("VALIDASI_GAGAL");
    return {
      koreksiId: pertama.koreksiId,
      nilaiAsliG: pertama.nilaiAsliG,
      nilaiFinalG: pertama.nilaiFinalG,
      kode: s.kode,
      status: s.status,
      versi: s.versi,
      koreksi,
    };
  },

  // Foto, tiket, sinkron
  "POST /api/foto": (c) => {
    if (c.body.jenis === "MUATAN" && skenario("r04") === "1") {
      throw new GalatMock("ATURAN_DITOLAK", "R04", {
        kode: "R04",
        aksi: "TOLAK",
        teks: isi("ATURAN_R04", { kode_serah: kodeSerah(c.sekarang, 4) }),
      });
    }
    return { fotoId: idm("fto", state.urutLain++), dhash: "0f0f0f0f0f0f0f0f" };
  },
  "POST /api/tiket/baca": () => {
    const mode = skenario("ai") ?? "TINGGI";
    if (mode === "MATI") throw new GalatMock("AI_TIDAK_TERSEDIA");
    if (mode === "RAGU") {
      return { nomorTiket: null, beratKgTeks: "4?,5", tanggal: null, keyakinan: "RENDAH" as const, model: "claude-haiku-5-5" };
    }
    return { nomorTiket: "TKT-CONTOH-001", beratKgTeks: "30", tanggal: null, keyakinan: "TINGGI" as const, model: "claude-haiku-5-5" };
  },
  "POST /api/sinkron": (c) => {
    // Meniru server: satu efek per idempotencyKey; tiap aksi dievaluasi terhadap keadaan saat diterima.
    const aksi = (c.body.aksi as Array<{ idempotencyKey: string; jenis: string; payload: Record<string, unknown> }> | undefined) ?? [];
    return {
      hasil: aksi.map((a) => {
        if (state.kunciTerapan.has(a.idempotencyKey)) return { idempotencyKey: a.idempotencyKey, status: "DUPLIKAT" as const };
        const handler =
          a.jenis === "WADAH_CATAT" ? HANDLER["POST /api/wadah"] : a.jenis === "SERAH_BUAT" ? HANDLER["POST /api/serah"] : undefined;
        try {
          handler?.({ params: {}, kueri: {}, body: a.payload, sekarang: c.sekarang });
          state.kunciTerapan.add(a.idempotencyKey);
          return { idempotencyKey: a.idempotencyKey, status: "DITERAPKAN" as const };
        } catch (e) {
          if (!(e instanceof GalatMock)) throw e;
          return {
            idempotencyKey: a.idempotencyKey,
            status: "DITOLAK" as const,
            galat: { kode: e.kode, pesan: e.message, ...(e.aturan ? { aturan: e.aturan } : {}) },
          };
        }
      }),
    };
  },

  // Rantai & cuaca
  "GET /api/rantai/verifikasi": () => ({ utuh: true, jumlah: state.serah.length * 3, patahDiUrutan: null }),
  "GET /api/cuaca/[adm4]": (c) => ({
    adm4: c.params.adm4 ?? KAWASAN.adm4,
    mode: "SNAPSHOT",
    analysisDate: iso(c.sekarang, 2),
    basi: false,
    pesan: isi("G_BMKG_SNAPSHOT", { waktu: "12:00" }),
    slot: [
      { slotUtc: iso(c.sekarang, -3), weatherDesc: "Hujan Lebat", weatherDescEn: "Heavy Rain" },
      { slotUtc: iso(c.sekarang, -6), weatherDesc: "Berawan", weatherDescEn: "Mostly Cloudy" },
    ],
  }),
  "GET /api/tps/[id]/prioritas": (c) => {
    const t = tpsDari(c.params.id);
    if (state.tps.indexOf(t) !== 0) return { prioritas: null };
    return {
      prioritas: {
        sumber: "PRAKIRAAN",
        acuan: iso(c.sekarang, -3),
        aliran: "KUNING",
        umurJam: 30,
        teks: teksR10Prakiraan(30),
        catatan: TEKS.R10_CATATAN,
      },
    };
  },

  // Laporan
  "GET /api/laporan/[pihak]": (c) => ({
    pihak: c.params.pihak ?? "kawasan",
    periode: periodeDari(c.kueri, c.sekarang),
    baris: barisLaporan(c.sekarang),
    total: totalAliran(c.sekarang, false),
  }),
  "GET /api/laporan/[pihak]/ekspor": () => "",
  "GET /api/kawasan/[id]/lembar-neraca": () => "",
  "GET /api/kawasan/[id]/ringkasan": (c) => ({
    periode: periodeDari(c.kueri, c.sekarang),
    hariIni: totalAliran(c.sekarang, true),
    bulanIni: totalAliran(c.sekarang, false),
    menungguSetuju: state.serah.filter((s) => s.status === "MENUNGGU_SETUJU").length,
    menggantung: state.serah.filter((s) => s.status === "MENGGANTUNG").length,
    prioritas: [{ tpsId: idm("tps", 1), tpsKode: "TPS-PCS-01", teks: teksR10Prakiraan(30) }],
    peringatan: [
      { kode: "R06" as const, aksi: "PERINGATAN" as const, teks: isi("ATURAN_R06", { kode_tps: "TPS-PCS-02", jam: 26 }) },
      { kode: "R09" as const, aksi: "PERINGATAN" as const, teks: isi("ATURAN_R09", { kode_tps: "TPS-PCS-02" }) },
    ],
  }),
  "GET /api/kawasan/[id]/ditolak": (c) => {
    const ditolakG = state.serah.reduce((j, s) => j + s.rincian.filter((r) => r.aliran === "KUNING").reduce((x, r) => x + r.ditolakG, 0), 0);
    const diterimaG = state.serah.reduce((j, s) => j + s.rincian.filter((r) => r.aliran === "KUNING").reduce((x, r) => x + r.diterimaG, 0), 0);
    return {
      periode: periodeDari(c.kueri, c.sekarang),
      kuning: { diterimaG, ditolakG },
      alasan: [{ alasan: "BASAH_KOTOR" as const, ditolakG, jumlahSerah: sudahTutup(), selisihIdr: null }],
      sumberHarga: null,
    };
  },

  // Permintaan koreksi
  "POST /api/permintaan-koreksi": () => ({ id: idm("pkr", state.urutLain++), kode: `PKR-${tanggalWib(Date.now()).replace(/-/g, "")}-001` }),
  "GET /api/permintaan-koreksi": (c) => ({
    permintaan: [
      {
        id: idm("pkr", 1),
        kode: `PKR-${tanggalWib(c.sekarang).replace(/-/g, "")}-001`,
        targetJenis: "WADAH" as const,
        targetId: idm("wdh", 1),
        nilaiAsliG: 12_500,
        nilaiUsulanG: 12_000,
        alasan: "Contoh: salah timbang",
        peranPengaju: "PETUGAS" as const,
        status: "DIAJUKAN" as const,
        dibuatPada: iso(c.sekarang, 2),
        putusan: null,
      },
    ],
  }),
  "POST /api/permintaan-koreksi/[id]/putus": (c) => ({
    permintaan: {
      id: c.params.id ?? idm("pkr", 1),
      kode: `PKR-${tanggalWib(c.sekarang).replace(/-/g, "")}-001`,
      targetJenis: "WADAH" as const,
      targetId: idm("wdh", 1),
      nilaiAsliG: 12_500,
      nilaiUsulanG: 12_000,
      alasan: "Contoh: salah timbang",
      peranPengaju: "PETUGAS" as const,
      status: c.body.keputusan === "DISETUJUI" ? ("DISETUJUI" as const) : ("DITOLAK" as const),
      dibuatPada: iso(c.sekarang, 2),
      putusan: {
        keputusan: c.body.keputusan === "DISETUJUI" ? ("DISETUJUI" as const) : ("DITOLAK" as const),
        alasan: String(c.body.alasan ?? ""),
        peran: peranMock(),
        dibuatPada: iso(c.sekarang),
      },
    },
  }),

  // Notifikasi & push
  "GET /api/langsung": () => "",
  "GET /api/notifikasi": (c) => {
    const semua = notifikasiContoh(c.sekarang).map((n) => ({ ...n, dibaca: n.dibaca || state.notifDibaca.has(n.id) }));
    return { notifikasi: c.kueri.belumDibaca === true || c.kueri.belumDibaca === "true" ? semua.filter((n) => !n.dibaca) : semua };
  },
  "POST /api/notifikasi/[id]/baca": (c) => {
    state.notifDibaca.add(String(c.params.id));
    return { id: String(c.params.id), dibaca: true };
  },
  "POST /api/notifikasi/baca-semua": (c) => {
    const belum = notifikasiContoh(c.sekarang).filter((n) => !n.dibaca && !state.notifDibaca.has(n.id));
    belum.forEach((n) => state.notifDibaca.add(n.id));
    return { jumlah: belum.length };
  },
  "POST /api/push/langganan": () => ok,
  "DELETE /api/push/langganan": () => ok,
  "GET /api/push/kunci-publik": () => ({ kunciPublik: null }),

  // Paket, langganan, tagihan
  "GET /api/paket": () => ({ paket: PAKET }),
  "GET /api/langganan": () => ({
    paketKode: PAKET[0]?.kode ?? "",
    status: "UJI_COBA",
    ujiCobaSelesai: "2026-11-15",
    hargaDibekukanPerTpsIdr: null,
    periodeBerjalan: "2026-10",
    tpsDitagih: state.tps.length,
  }),
  "GET /api/tagihan": () => ({ tagihan: state.tagihan }),
  "POST /api/tagihan/[nomor]/bayar": () => ({ snapToken: "mock-token-sandbox", redirectUrl: "https://example.com/sandbox-bayar" }),
  "POST /api/tagihan/[nomor]/transfer": (c) => {
    const t = state.tagihan.find((x) => x.nomor === c.params.nomor);
    if (!t) throw new GalatMock("TIDAK_DITEMUKAN");
    t.status = "MENUNGGU_KONFIRMASI";
    return { tagihan: t };
  },
  "GET /api/tagihan/[nomor]/status": (c) => {
    const t = state.tagihan.find((x) => x.nomor === c.params.nomor);
    if (!t) throw new GalatMock("TIDAK_DITEMUKAN");
    return { tagihan: t };
  },

  // Tagihan angkut
  "GET /api/tagihan-angkut": (c) => {
    const pratinjau =
      typeof c.kueri.kontrakId === "string" && typeof c.kueri.periode === "string"
        ? {
            kontrakId: c.kueri.kontrakId,
            periode: c.kueri.periode,
            ritTertutup: 2,
            kgDiterimaG: 52_000,
            totalIdr: 300_000,
            rincian: state.serah
              .filter((s) => s.status === "DITERIMA" || s.status === "DITERIMA_SEBAGIAN")
              .map((s) => ({ kodeSerah: s.kode, kgDiterimaG: s.rincian.reduce((j, r) => j + r.diterimaG, 0), subtotalIdr: 150_000 })),
            tidakTermasuk: state.serah.filter((s) => s.status === "DITOLAK" || s.status === "DIANGKUT").length,
          }
        : null;
    return { pratinjau, tagihan: [] };
  },
  "POST /api/tagihan-angkut/terbitkan": (c) => ({
    tagihan: {
      id: idm("tga", 1),
      kode: "TGA-202610-0001",
      kontrakId: String(c.body.kontrakId),
      periode: String(c.body.periode),
      ritTertutup: 2,
      kgDiterimaG: 52_000,
      totalIdr: 300_000,
      rincian: [],
      diterbitkanPada: iso(c.sekarang),
    },
  }),

  // Mode bayangan
  "POST /api/bayangan": () => ({ id: idm("byg", state.urutLain++) }),
  "GET /api/bayangan/perbandingan": (c) => ({
    periode: periodeDari(c.kueri, c.sekarang),
    baris: [
      { aliran: "KUNING" as const, serahG: 52_000, bayanganG: 55_000, selisihG: 3_000, sumberCatatan: ["Buku catatan contoh"] },
      { aliran: "HIJAU" as const, serahG: 30_000, bayanganG: 28_000, selisihG: -2_000, sumberCatatan: ["Buku catatan contoh"] },
    ],
  }),

  // Admin
  "GET /api/admin/organisasi": () => ({ organisasi: ORGANISASI }),
  "GET /api/admin/organisasi/[id]": (c) => {
    const org = ORGANISASI.find((x) => x.id === c.params.id);
    if (!org) throw new GalatMock("TIDAK_DITEMUKAN");
    return { organisasi: org, jumlahAnggota: 3, jumlahKawasan: org.jenis === "KAWASAN" ? 1 : 0, jumlahTpsAktif: org.jenis === "KAWASAN" ? 2 : 0, paketKode: PAKET[0]?.kode ?? null };
  },
  "POST /api/admin/izin/[organisasiId]/putus": (c) => {
    const org = ORGANISASI.find((x) => x.id === c.params.organisasiId);
    if (!org) throw new GalatMock("TIDAK_DITEMUKAN");
    return { organisasi: { ...org, statusIzin: c.body.keputusan === "TERVERIFIKASI" ? ("TERVERIFIKASI" as const) : ("DITOLAK" as const) } };
  },
  "GET /api/admin/pembayaran": () => ({
    tagihan: state.tagihan.map((t) => ({ ...t, organisasiId: ORG.kawasan, organisasiNama: KAWASAN.nama, fotoBuktiId: null })),
  }),
  "POST /api/admin/pembayaran/[tagihanId]/konfirmasi": (c) => {
    const t = state.tagihan[0];
    if (!t) throw new GalatMock("TIDAK_DITEMUKAN");
    return { tagihan: { ...t, id: c.params.tagihanId ?? t.id, status: c.body.keputusan === "SETUJUI" ? ("LUNAS" as const) : ("DIBATALKAN" as const) } };
  },
  "GET /api/admin/paket": () => ({ paket: PAKET }),
  "POST /api/admin/paket": (c) => ({ paket: { ...(PAKET[0] as (typeof PAKET)[number]), kode: String(c.body.kode ?? "PAKET_BARU_CONTOH") } }),
  "PUT /api/admin/paket/[kode]/entitlement": () => ({ paket: PAKET[0] as (typeof PAKET)[number] }),
  "GET /api/admin/aturan": (c) => ({
    aturan: [
      {
        id: idm("atr", 1),
        kode: "R05" as const,
        yurisdiksi: "DKI" as const,
        versi: 1,
        sumber: "Pergub DKI Jakarta No. 102 Tahun 2021 Pasal 8 ayat (1) huruf g",
        aksi: "PERINGATAN" as const,
        ambang: { jam: 72 },
        kunciTeks: "ATURAN_R05",
        berlakuDari: iso(c.sekarang, 24 * 30),
      },
    ],
  }),
  "POST /api/admin/aturan": (c) => ({
    aturan: {
      id: idm("atr", state.urutLain++),
      kode: c.body.kode as "R05",
      yurisdiksi: c.body.yurisdiksi as "DKI",
      versi: 2,
      sumber: String(c.body.sumber ?? ""),
      aksi: c.body.aksi as "PERINGATAN",
      ambang: (c.body.ambang as Record<string, number> | undefined) ?? {},
      kunciTeks: String(c.body.kunciTeks ?? ""),
      berlakuDari: String(c.body.berlakuDari ?? iso(c.sekarang)),
    },
  }),
  "GET /api/admin/audit": (c) => ({
    audit: [
      {
        id: idm("aud", 1),
        organisasiId: ORG.kawasan,
        peran: "ADMIN" as const,
        aksi: "ORGANISASI_DIBUKA",
        objekJenis: "organisasi",
        objekId: ORG.kawasan,
        alasan: "Contoh: memeriksa laporan dukungan pelanggan",
        dibuatPada: iso(c.sekarang, 5),
      },
    ],
  }),
  "GET /api/admin/metrik": () => ({ serahTertutupBp: 8_500, hariTpsTercatatBp: 9_000, kawasanAktif7Hari: 1 }),
  "POST /api/admin/demo/reset": () => {
    reset();
    return ok;
  },

  // Sistem
  "GET /api/health": () => ({ versi: "mock", db: "ok" as const, bmkgUmurJam: 2 }),
};

/** Kembalikan semua keadaan mock ke awal (tombol DEMO_RESET). */
export function reset(): void {
  state.serah = [];
  state.wadah = [];
  state.notifDibaca = new Set();
  state.kendaraan = KENDARAAN.map((k) => ({ ...k }));
  state.tps = TPS_DAFTAR.map((t) => ({ ...t }));
  state.kontrak = KONTRAK.map((k) => ({ ...k }));
  state.anggota = ANGGOTA.map((a) => ({ ...a }));
  state.tagihan = tagihanContoh();
  state.urutSerah = 7;
  state.urutLain = 100;
  state.kunciTerapan = new Set();
  state.diinisialisasi = false;
}

/** Daftar kunci "METODE jalur" yang ditangani mock (dipakai test cakupan). */
export const RUTE_MOCK: readonly string[] = Object.keys(HANDLER);

/** Jalankan satu handler mentah; melempar GalatMock bila handler menolak. */
export function jalankanMock(metode: string, jalur: string, opsi: OpsiMentah, sekarang: number): unknown {
  const handler = HANDLER[`${metode} ${jalur}`];
  if (!handler) throw new GalatMock("TIDAK_DITEMUKAN", `mock tidak ada: ${metode} ${jalur}`);
  inisialisasi(sekarang);
  return handler({
    params: opsi.params ?? {},
    kueri: (opsi.kueri ?? {}) as Record<string, unknown>,
    body: (opsi.body ?? {}) as Record<string, unknown>,
    sekarang,
  });
}

/** Titik masuk dari api.ts. Memberi jeda singkat agar keadaan memuat terlihat. */
export async function panggilMock(metode: string, jalur: string, opsi: OpsiMentah): Promise<HasilApi<unknown>> {
  await new Promise((r) => setTimeout(r, 60));
  try {
    const data = jalankanMock(metode, jalur, opsi, Date.now());
    return { ok: true, data };
  } catch (e) {
    if (e instanceof GalatMock) {
      const galat: Galat = { kode: e.kode, pesan: e.message, ...(e.aturan ? { aturan: e.aturan } : {}) };
      const { teksGalat } = await import("./api");
      return { ok: false, galat, pesan: teksGalat(galat) };
    }
    throw e;
  }
}
