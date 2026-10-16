import { createHash } from "node:crypto";
import { emailDemo } from "@serah/kontrak/demo";
import { HARI_MS, JAM_MS, acakBerbenih, awalHariWib, idBaru, sisip, tanggalWib, tulis, type Klien } from "./alat.ts";
import { VERSI_PERSETUJUAN } from "./global.ts";

// Seed demo §H.5 — HANYA bila DEMO_MODE=true. Semua nama adalah contoh berlabel; tidak ada nama pelanggan nyata.
// Koordinat TPS: KEPUTUSAN K-15 belum diisi (P-06) → "koordinat contoh sementara", diganti lewat prompt (g).

export const KODE_ORG_DEMO = "ORG-PCS";

const KOORDINAT_SEMENTARA = {
  // koordinat contoh sementara (K-15 MENUNGGU P-06)
  "TPS-PCS-01": { lat: -6161234, lon: 106845678 },
  "TPS-PCS-02": { lat: -6162345, lon: 106846789 },
} as const;

type Event = {
  t: Date;
  kawasanId: string;
  serahId: string | null;
  serahKode: string | null;
  orgKawasan: string;
  orgPengangkut: string | null;
  orgPenerima: string | null;
  jenis: string;
  peran: string | null;
  payload: Record<string, unknown>;
};

export async function seedDemo(k: Klien, sekarang: Date): Promise<boolean> {
  if (process.env.DEMO_MODE !== "true") throw new Error("Seed demo ditolak: DEMO_MODE bukan true");
  const ada = await k.query(`SELECT 1 FROM organisasi WHERE kode = $1`, [KODE_ORG_DEMO]);
  if (ada.rowCount) {
    tulis("· data demo sudah ada — dilewati (pakai pnpm db:reset untuk mengulang dari awal)");
    return false;
  }
  const acak = acakBerbenih(102_2021);
  const antara = (min: number, maks: number) => Math.floor(min + acak() * (maks - min + 1));
  const hari = (n: number) => new Date(sekarang.getTime() - n * HARI_MS);
  const pepper = process.env.TOKEN_PEPPER ?? "";

  // ── Organisasi ────────────────────────────────────────────────────────────
  const org = {
    kawasan: idBaru(),
    pengangkut: idBaru(),
    daurUlang: idBaru(),
    pelapakBerkah: idBaru(),
    pelapakBaru: idBaru(),
    tpst: idBaru(),
    b3: idBaru(),
    tps3r: idBaru(),
    internal: idBaru(),
  };
  const daftarOrg = [
    { id: org.kawasan, kode: KODE_ORG_DEMO, nama: "Pasar Contoh Sejahtera", jenis: "KAWASAN", jp: null, aliran: [], izin: "BELUM_DIAJUKAN" },
    { id: org.pengangkut, kode: "ORG-ACB", nama: "Angkut Contoh Bersih", jenis: "PENGANGKUT", jp: null, aliran: [], izin: "TERVERIFIKASI" },
    { id: org.daurUlang, kode: "ORG-DUCM", nama: "Daur Ulang Contoh Mandiri", jenis: "PENERIMA", jp: "FASILITAS_BERIZIN", aliran: ["KUNING"], izin: "TERVERIFIKASI" },
    { id: org.pelapakBerkah, kode: "ORG-PCBK", nama: "Pelapak Contoh Berkah", jenis: "PENERIMA", jp: "PELAPAK_BERIZIN", aliran: ["KUNING"], izin: "TERVERIFIKASI" },
    { id: org.pelapakBaru, kode: "ORG-PCBR", nama: "Pelapak Contoh Baru", jenis: "PENERIMA", jp: "PELAPAK_BERIZIN", aliran: ["KUNING"], izin: "MENUNGGU" },
    { id: org.tpst, kode: "ORG-TPSTC", nama: "TPST Contoh", jenis: "PENERIMA", jp: "TPA_TPST", aliran: ["ABU"], izin: "TERVERIFIKASI" },
    { id: org.b3, kode: "ORG-FB3C", nama: "Fasilitas B3 Contoh", jenis: "PENERIMA", jp: "FASILITAS_BERIZIN", aliran: ["MERAH"], izin: "TERVERIFIKASI" },
    { id: org.tps3r, kode: "ORG-TPS3RC", nama: "TPS3R Contoh", jenis: "PENERIMA", jp: "TPS3R", aliran: ["HIJAU"], izin: "TERVERIFIKASI" },
    { id: org.internal, kode: "ORG-INTERNAL", nama: "Admin SERAH (contoh)", jenis: "INTERNAL", jp: null, aliran: [], izin: "BELUM_DIAJUKAN" },
  ];
  for (const o of daftarOrg) {
    await sisip(k, "organisasi", {
      id: o.id,
      kode: o.kode,
      nama: o.nama,
      jenis: o.jenis,
      jenis_penerima: o.jp,
      aliran_diterima: o.aliran,
      nomor_izin: o.izin === "BELUM_DIAJUKAN" ? null : `IZIN-CONTOH-${o.kode}`,
      status_izin: o.izin,
      yurisdiksi: "DKI",
      demo: true,
      dibuat_pada: hari(60),
    });
  }

  // ── Akun demo per peran (masuk lewat tombol demo, tanpa sandi) ───────────
  const akun = [
    { peran: "PETUGAS", org: org.kawasan, pengurus: false },
    { peran: "PENGELOLA", org: org.kawasan, pengurus: true },
    { peran: "PENGANGKUT", org: org.pengangkut, pengurus: true },
    { peran: "PENERIMA", org: org.daurUlang, pengurus: true },
    { peran: "ADMIN", org: org.internal, pengurus: true },
  ];
  for (const a of akun) {
    const pengguna = idBaru();
    await sisip(k, "pengguna", { id: pengguna, email: emailDemo(a.peran), email_terverifikasi_pada: hari(60), dibuat_pada: hari(60) });
    await sisip(k, "persetujuan_pdp", { id: idBaru(), pengguna_id: pengguna, versi: VERSI_PERSETUJUAN, jenis: "LAYANAN", pada: hari(60) });
    await sisip(k, "keanggotaan", { id: idBaru(), pengguna_id: pengguna, organisasi_id: a.org, peran: a.peran, pengurus: a.pengurus, aktif: true, dibuat_pada: hari(60) });
  }

  // ── Kawasan, TPS, kendaraan, kontrak, langganan ─────────────────────────
  const kawasan = idBaru();
  await sisip(k, "kawasan", {
    id: kawasan,
    organisasi_id: org.kawasan,
    kode: "KWS-PCS",
    nama: "Pasar Contoh Sejahtera",
    jenis: "KOMERSIAL",
    alamat: "Alamat contoh, Kemayoran, Jakarta Pusat",
    adm4: "31.71.03.1001",
    kode_kecamatan: "31.71.03",
    nama_kelurahan: "Kemayoran",
    nama_kecamatan: "Kemayoran",
    kota: "Jakarta Pusat",
    dibuat_pada: hari(60),
  });
  const tps: { id: string; kode: string }[] = [];
  for (const [i, kode] of (["TPS-PCS-01", "TPS-PCS-02"] as const).entries()) {
    const id = idBaru();
    tps.push({ id, kode });
    // Token QR demo dapat ditebak (hanya DEMO_MODE) agar QR contoh bisa dicetak ulang: "demo-qr-<kode>".
    const hashQr = createHash("sha256").update(`demo-qr-${kode}${pepper}`, "utf8").digest("hex");
    await sisip(k, "tps", {
      id,
      kawasan_id: kawasan,
      organisasi_id: org.kawasan,
      kode,
      nama: `TPS ${i + 1} (contoh)`,
      lat_e6: KOORDINAT_SEMENTARA[kode].lat,
      lon_e6: KOORDINAT_SEMENTARA[kode].lon,
      qr_token_hash: hashQr,
      qr_versi: 1,
      aktif: true,
      dibuat_pada: hari(60),
    });
  }
  const kendaraan = [idBaru(), idBaru()];
  for (const [i, plat] of ["B 9001 SRH", "B 9002 SRH"].entries()) {
    await sisip(k, "kendaraan", { id: kendaraan[i], organisasi_id: org.pengangkut, plat, aktif: true, dibuat_pada: hari(60) });
  }

  const kontrakAktif: Record<string, string> = {};
  const daftarKontrak = [
    { penerima: org.daurUlang, aliran: "KUNING", status: "AKTIF" },
    { penerima: org.pelapakBerkah, aliran: "KUNING", status: "AKTIF" },
    { penerima: org.tpst, aliran: "ABU", status: "AKTIF" },
    { penerima: org.tps3r, aliran: "HIJAU", status: "AKTIF" },
    { penerima: org.b3, aliran: "MERAH", status: "AKTIF" },
    { penerima: org.pelapakBaru, aliran: "KUNING", status: "USULAN" },
  ];
  for (const c of daftarKontrak) {
    const id = idBaru();
    if (c.status === "AKTIF") kontrakAktif[c.penerima] = id;
    await sisip(k, "kontrak", {
      id,
      kawasan_id: kawasan,
      org_kawasan_id: org.kawasan,
      org_pengangkut_id: org.pengangkut,
      org_penerima_id: c.penerima,
      aliran: [c.aliran],
      berlaku_dari: awalHariWib(sekarang, -60),
      berlaku_sampai: awalHariWib(sekarang, 305),
      status: c.status,
      dikonfirmasi_pengangkut_pada: c.status === "AKTIF" ? hari(59) : null,
      dikonfirmasi_penerima_pada: c.status === "AKTIF" ? hari(59) : null,
      dibuat_pada: hari(60),
    });
  }

  const langganan = idBaru();
  await sisip(k, "langganan", {
    id: langganan,
    organisasi_id: org.kawasan,
    paket_kode: "KAWASAN_UJI_COBA",
    status: "UJI_COBA",
    uji_coba_mulai: awalHariWib(sekarang),
    uji_coba_selesai: awalHariWib(sekarang, 14),
    diperbarui_pada: sekarang,
  });
  await sisip(k, "peristiwa_langganan", { id: idBaru(), langganan_id: langganan, dari: null, ke: "UJI_COBA", sebab: "seed demo", dibuat_pada: sekarang });

  // Tagihan contoh berstatus TERBIT agar alur bayar (Midtrans sandbox / transfer) bisa dicoba di /kawasan/langganan.
  const hariIni = tanggalWib(sekarang);
  const periodeIni = `${hariIni.slice(0, 4)}-${hariIni.slice(4, 6)}`;
  const jt = tanggalWib(new Date(sekarang.getTime() + 14 * HARI_MS));
  await sisip(k, "tagihan", {
    id: idBaru(),
    nomor: `TGH-${periodeIni.replace("-", "")}-0001`,
    organisasi_id: org.kawasan,
    periode: periodeIni,
    jumlah_tps: 2,
    harga_per_tps_idr: 350000,
    total_idr: 700000,
    status: "TERBIT",
    jatuh_tempo: `${jt.slice(0, 4)}-${jt.slice(4, 6)}-${jt.slice(6, 8)}`,
    dibuat_pada: sekarang,
  });

  // ── Riwayat 30 hari sintetis ─────────────────────────────────────────────
  const event: Event[] = [];
  const dasarEvent = { kawasanId: kawasan, orgKawasan: org.kawasan, orgPengangkut: null, orgPenerima: null, serahId: null, serahKode: null };

  type Wadah = { id: string; tps: string; aliran: string; beratG: number; t: Date };
  const wadahPer = new Map<string, Wadah[]>(); // kunci: tps|aliran|blok
  const RENTANG: Record<string, [number, number]> = { HIJAU: [20_000, 60_000], KUNING: [5_000, 25_000], ABU: [10_000, 40_000], MERAH: [500, 2_000] };

  async function catatWadah(tpsId: string, aliran: string, t: Date, kunciKelompok: string | null) {
    const [min, maks] = RENTANG[aliran] ?? [1_000, 2_000];
    const w: Wadah = { id: idBaru(), tps: tpsId, aliran, beratG: antara(min, maks), t };
    await sisip(k, "wadah_catat", {
      id: w.id,
      tps_id: tpsId,
      kawasan_id: kawasan,
      org_kawasan_id: org.kawasan,
      aliran,
      berat_g: w.beratG,
      terjadi_pada: t,
      diterima_pada: t,
      idempotency_key: `demo-wadah-${w.id}`,
      offline: false,
    });
    event.push({ ...dasarEvent, t, jenis: "WADAH_DICATAT", peran: "PETUGAS", payload: { wadahId: w.id, aliran, beratG: w.beratG } });
    if (kunciKelompok) wadahPer.set(kunciKelompok, [...(wadahPer.get(kunciKelompok) ?? []), w]);
  }

  // Blok 3 hari × 10 (hari ke-30 … ke-1 sebelum hari ini): KUNING & ABU per TPS, lalu diserahkan per blok.
  for (let blok = 0; blok < 10; blok++) {
    for (let d = 0; d < 3; d++) {
      const hariKe = 30 - blok * 3 - d;
      const pagi = new Date(awalHariWib(sekarang, -hariKe).getTime() + 7 * JAM_MS);
      for (const [ti, t] of tps.entries()) {
        for (const [ai, aliran] of ["KUNING", "ABU"].entries()) {
          await catatWadah(t.id, aliran, new Date(pagi.getTime() + (ti * 2 + ai) * 10 * 60_000), `${t.id}|${aliran}|${blok}`);
        }
      }
    }
  }
  // Hari ini: wadah segar yang menunggu diangkut (untuk demo petugas & pengangkut).
  const pagiIni = new Date(Math.min(awalHariWib(sekarang).getTime() + 7 * JAM_MS, sekarang.getTime() - 2 * JAM_MS));
  for (const [ti, t] of tps.entries()) {
    for (const [ai, aliran] of (ti === 0 ? ["HIJAU", "KUNING", "ABU", "MERAH"] : ["HIJAU", "KUNING", "ABU"]).entries()) {
      await catatWadah(t.id, aliran, new Date(pagiIni.getTime() + (ti * 4 + ai) * 5 * 60_000), null);
    }
  }

  // 40 serah: urutan kronologis; 5 terakhir sedang berjalan.
  type RencanaSerah = { tps: { id: string; kode: string }; aliran: string; blok: number };
  const rencana: RencanaSerah[] = [];
  for (let blok = 0; blok < 10; blok++) for (const t of tps) for (const aliran of ["KUNING", "ABU"]) rencana.push({ tps: t, aliran, blok });

  const kuningSelesai = rencana.map((r, i) => (r.aliran === "KUNING" && i < 35 ? i : -1)).filter((i) => i >= 0);
  const indeksDitolak = new Set([kuningSelesai[3], kuningSelesai[8], kuningSelesai[13]]);
  const indeksSebagian = new Set([1, 5, 7, 10, 12, 15, 16].map((n) => kuningSelesai[n]));
  const statusUntuk = (i: number): string => {
    if (i === 39) return "DRAF";
    if (i === 38) return "MENUNGGU_SETUJU";
    if (i === 37) return "DIANGKUT";
    if (i === 36 || i === 35) return "MENGGANTUNG";
    if (indeksDitolak.has(i)) return "DITOLAK";
    if (indeksSebagian.has(i)) return "DITERIMA_SEBAGIAN";
    return "DITERIMA";
  };
  const penerimaUntuk = (aliran: string, i: number) => (aliran === "ABU" ? org.tpst : i % 4 === 0 ? org.pelapakBerkah : org.daurUlang);
  const alasanTolak = ["TERCAMPUR_ORGANIK", "BASAH_KOTOR", "RESIDU_BERLEBIH"];

  const nomorHarian = new Map<string, number>();
  const serahSelesai: { id: string; kode: string; wadah: Wadah[] }[] = [];

  for (const [i, r] of rencana.entries()) {
    const status = statusUntuk(i);
    const wadah = wadahPer.get(`${r.tps.id}|${r.aliran}|${r.blok}`) ?? [];
    const akhirBlok = awalHariWib(sekarang, -(28 - r.blok * 3));
    // Waktu: serah selesai sore akhir blok; serah yang masih berjalan ditaruh relatif terhadap sekarang.
    const jadwal: Record<string, Date> = {
      DRAF: new Date(sekarang.getTime() - 1 * JAM_MS),
      MENUNGGU_SETUJU: new Date(sekarang.getTime() - 3 * JAM_MS),
      DIANGKUT: new Date(sekarang.getTime() - 6 * JAM_MS),
      MENGGANTUNG: new Date(sekarang.getTime() - (i === 36 ? 26 : 30) * JAM_MS),
    };
    const dibuat = jadwal[status] ?? new Date(akhirBlok.getTime() + 14 * JAM_MS);
    const tanggal = tanggalWib(dibuat);
    const nomor = (nomorHarian.get(tanggal) ?? 0) + 1;
    nomorHarian.set(tanggal, nomor);
    const kode = `SRH-${tanggal}-${String(nomor).padStart(4, "0")}`;
    const serahId = idBaru();
    const penerima = penerimaUntuk(r.aliran, i);
    const sudahAmbil = status !== "DRAF";
    const kendaraanId = kendaraan[i % 2] ?? null;
    const tAmbil = new Date(dibuat.getTime() + 60 * 60_000);
    const tSetuju = new Date(dibuat.getTime() + 75 * 60_000);
    const tTutup = new Date(dibuat.getTime() + 3 * JAM_MS);
    const dasar = { kawasanId: kawasan, serahId, serahKode: kode, orgKawasan: org.kawasan };

    await sisip(k, "serah", {
      id: serahId,
      kode,
      tps_id: r.tps.id,
      kawasan_id: kawasan,
      org_kawasan_id: org.kawasan,
      org_pengangkut_id: sudahAmbil ? org.pengangkut : null,
      org_penerima_id: sudahAmbil ? penerima : null,
      kontrak_id: sudahAmbil ? kontrakAktif[penerima] : null,
      kendaraan_id: sudahAmbil ? kendaraanId : null,
      status,
      versi: 0,
      dibuat_pada: dibuat,
      diperbarui_pada: dibuat,
    });
    for (const w of wadah) await sisip(k, "serah_wadah", { serah_id: serahId, wadah_catat_id: w.id });
    event.push({ ...dasar, orgPengangkut: null, orgPenerima: null, t: dibuat, jenis: "SERAH_DIBUAT", peran: "PETUGAS", payload: { wadahIds: wadah.map((w) => w.id) } });
    if (!sudahAmbil) continue;

    const fotoMuatan = idBaru();
    await sisip(k, "foto", {
      id: fotoMuatan,
      jenis: "MUATAN",
      organisasi_id: org.pengangkut,
      serah_id: serahId,
      object_key: `demo/muatan/${kode}.webp`,
      dhash: Array.from({ length: 16 }, () => Math.floor(acak() * 16).toString(16)).join(""),
      ukuran_byte: 120_000,
      lebar: 1280,
      tinggi: 960,
      diambil_pada: tAmbil,
      diterima_pada: tAmbil,
    });
    const pihak = { ...dasar, orgPengangkut: org.pengangkut, orgPenerima: penerima };
    event.push({ ...pihak, t: tAmbil, jenis: "SERAH_DIAMBIL", peran: "PENGANGKUT", payload: { fotoId: fotoMuatan, kendaraanId, penerimaId: penerima } });
    if (status === "MENUNGGU_SETUJU") continue;
    event.push({ ...pihak, t: tSetuju, jenis: "SERAH_DISETUJUI", peran: "PENGELOLA", payload: {} });
    if (status === "DIANGKUT") continue;
    if (status === "MENGGANTUNG") {
      event.push({ ...pihak, t: new Date(tSetuju.getTime() + 12 * JAM_MS + 10 * 60_000), jenis: "SERAH_MENGGANTUNG", peran: "SISTEM", payload: { jam: 12 } });
      continue;
    }

    // Penutupan
    const totalTps = wadah.reduce((s, w) => s + w.beratG, 0);
    const melenceng = i === 6 || i === 22; // dua tiket memicu R-08 (>20%) di demo
    const beratTiket = melenceng ? Math.round(totalTps * 1.25) : totalTps + antara(-300, 300);
    const ditolak = status === "DITOLAK" ? beratTiket : status === "DITERIMA_SEBAGIAN" ? Math.round(beratTiket * (0.1 + acak() * 0.3)) : 0;
    const alasan = ditolak > 0 ? (alasanTolak[i % alasanTolak.length] ?? "LAINNYA") : null;
    const fotoTiket = idBaru();
    await sisip(k, "foto", {
      id: fotoTiket,
      jenis: "TIKET",
      organisasi_id: penerima,
      serah_id: serahId,
      object_key: `demo/tiket/${kode}.webp`,
      dhash: Array.from({ length: 16 }, () => Math.floor(acak() * 16).toString(16)).join(""),
      ukuran_byte: 80_000,
      lebar: 960,
      tinggi: 1280,
      diambil_pada: tTutup,
      diterima_pada: tTutup,
    });
    const tiket = idBaru();
    const pakaiAi = i % 3 !== 0;
    await sisip(k, "tiket_timbang", {
      id: tiket,
      serah_id: serahId,
      foto_id: fotoTiket,
      nomor: `TK-CONTOH-${String(i + 1).padStart(3, "0")}`,
      berat_g: beratTiket,
      sumber: pakaiAi ? "AI_DIKONFIRMASI" : "MANUAL",
      ai_model: pakaiAi ? "claude-haiku-5-5" : null,
      ai_keyakinan: pakaiAi ? "TINGGI" : null,
      dibuat_pada: tTutup,
    });
    await sisip(k, "penutupan_rincian", {
      id: idBaru(),
      serah_id: serahId,
      aliran: r.aliran,
      diterima_g: beratTiket - ditolak,
      ditolak_g: ditolak,
      alasan,
      keterangan: null,
      dibuat_pada: tTutup,
    });
    const jenisTutup = status === "DITERIMA" ? "SERAH_DITERIMA" : status === "DITOLAK" ? "SERAH_DITOLAK" : "SERAH_DITERIMA_SEBAGIAN";
    event.push({
      ...pihak,
      t: tTutup,
      jenis: jenisTutup,
      peran: "PENERIMA",
      payload: { tiketId: tiket, beratTiketG: beratTiket, rincian: [{ aliran: r.aliran, diterimaG: beratTiket - ditolak, ditolakG: ditolak, alasan }] },
    });
    serahSelesai.push({ id: serahId, kode, wadah });
  }

  // ── Permintaan koreksi: 3 disetujui (→ 3 koreksi wadah) + 1 menunggu ─────
  const nomorPkr = new Map<string, number>();
  const sasaran = [serahSelesai[2], serahSelesai[9], serahSelesai[17], serahSelesai[25]];
  for (const [n, s] of sasaran.entries()) {
    const w = s?.wadah[0];
    if (!s || !w) continue;
    const tAju = new Date(w.t.getTime() + 2 * JAM_MS);
    const tgl = tanggalWib(tAju);
    const nomor = (nomorPkr.get(tgl) ?? 0) + 1;
    nomorPkr.set(tgl, nomor);
    const pkr = idBaru();
    const kodePkr = `PKR-${tgl}-${String(nomor).padStart(3, "0")}`;
    const usulan = w.beratG - 1_000;
    await sisip(k, "permintaan_koreksi", {
      id: pkr,
      kode: kodePkr,
      target_jenis: "WADAH",
      target_id: w.id,
      kawasan_id: kawasan,
      org_kawasan_id: org.kawasan,
      org_penerima_id: null,
      nilai_usulan_g: usulan,
      alasan: "Contoh: salah ketik berat di TPS",
      peran_pengaju: "PETUGAS",
      dibuat_pada: tAju,
    });
    event.push({ ...dasarEvent, t: tAju, jenis: "PERMINTAAN_KOREKSI_DIAJUKAN", peran: "PETUGAS", payload: { permintaanId: pkr, kode: kodePkr, targetJenis: "WADAH", targetId: w.id, nilaiUsulanG: usulan } });
    if (n === 3) continue; // yang keempat dibiarkan menunggu keputusan
    const tPutus = new Date(tAju.getTime() + JAM_MS);
    await sisip(k, "permintaan_koreksi_putusan", { id: idBaru(), permintaan_id: pkr, keputusan: "DISETUJUI", alasan: "Contoh: sesuai buku TPS", peran: "PENGELOLA", dibuat_pada: tPutus });
    await sisip(k, "koreksi", {
      id: idBaru(),
      target_jenis: "WADAH",
      target_id: w.id,
      serah_id: s.id,
      kawasan_id: kawasan,
      org_kawasan_id: org.kawasan,
      nilai_asli_g: w.beratG,
      nilai_final_g: usulan,
      alasan: "Contoh: sesuai buku TPS",
      peran: "PENGELOLA",
      permintaan_id: pkr,
      dibuat_pada: tPutus,
    });
    event.push({ ...dasarEvent, t: tPutus, jenis: "PERMINTAAN_KOREKSI_DISETUJUI", peran: "PENGELOLA", payload: { permintaanId: pkr, nilaiAsliG: w.beratG, nilaiFinalG: usulan } });
  }

  // ── Rantai: event disisipkan berurutan waktu; hash dihitung fungsi SQL hash_event (satu sumber kebenaran) ──
  event.sort((a, b) => a.t.getTime() - b.t.getTime());
  let prev = "0".repeat(64);
  for (const [n, e] of event.entries()) {
    const { rows } = await k.query<{ hash: string }>(
      `INSERT INTO event (id, kawasan_id, urutan_rantai, serah_id, org_kawasan_id, org_pengangkut_id, org_penerima_id, jenis, peran,
                          payload, prev_hash, hash, idempotency_key, terjadi_pada, diterima_pada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::"JenisEvent", $9::text::"PeranEvent", $10::jsonb, $11::text,
               hash_event($11::text, $8::text, $12::text, $9::text, $10::jsonb, $13::timestamptz), $14, $13::timestamptz, $13::timestamptz)
       RETURNING hash`,
      [idBaru(), e.kawasanId, n + 1, e.serahId, e.orgKawasan, e.orgPengangkut, e.orgPenerima, e.jenis, e.peran, JSON.stringify(e.payload), prev, e.serahKode, e.t, `demo-event-${n + 1}`],
    );
    prev = rows[0]?.hash ?? prev;
  }

  // ── Penomoran harian (kode baru melanjutkan nomor seed) ──────────────────
  for (const [tgl, nomor] of nomorHarian) await sisip(k, "penomoran", { jenis: "SRH", tanggal_atau_periode: tgl, nomor_terakhir: nomor });
  for (const [tgl, nomor] of nomorPkr) await sisip(k, "penomoran", { jenis: "PKR", tanggal_atau_periode: tgl, nomor_terakhir: nomor });

  tulis(`✓ demo: ${daftarOrg.length} organisasi, ${rencana.length} serah, ${event.length} event berantai`);
  return true;
}
