import type { Prisma } from "@serah/db";
import { TEKS, type JenisNotifikasi, type JenisOrganisasi, type KunciTeks, type Peran } from "@serah/kontrak";
import { buatPengirim, type Pengirim } from "../adaptor/email";
import { susunEmail, templatNotifikasi } from "../adaptor/email/templat";
import { buatPengirimPush, type PengirimPush } from "../adaptor/push";
import { denganSistem, setelahCommit, type Tx } from "./db";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";
import { boleh } from "./hak";
import { log } from "./log";

// Notifikasi (BLUEPRINT §F.4, §O.5, §M.11; FITUR F30). buatNotifikasi = SATU-SATUNYA penulis baris notifikasi.
// - Ditujukan ke PERAN dalam organisasi, bukan orang; peran ditentukan tabel PERAN_TUJUAN (jenis × jenis organisasi).
// - `data` = nilai placeholder teks NTF_<jenis> (tanpa data pribadi), sehingga in-app, push, dan email memakai teks §M.11.
// - Push & email dikirim SETELAH transaksi commit, ke anggota aktif berperan tujuan, sesuai preferensi pengguna
//   (bawaan: aktif) dan hak paket notifikasi.push / notifikasi.email (lewat boleh()). Push 404/410 → langganan dihapus.
// - NOTIFY kanal org_<id> {t:"notifikasi", jenis, kode, versi:0, peran} untuk SSE (hanya peran tujuan yang menerima).

type PeranMenurutOrg = Partial<Record<JenisOrganisasi, readonly Peran[]>>;

/** Siapa menerima tiap jenis notifikasi, per jenis organisasi (matriks §G). Kombinasi lain = tidak ada penerima. */
export const PERAN_TUJUAN: Record<JenisNotifikasi, PeranMenurutOrg> = {
  SERAH_MENUNGGU_SETUJU: { KAWASAN: ["PENGELOLA"] },
  SERAH_DIANGKUT: { PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  SERAH_DITUTUP: { KAWASAN: ["PENGELOLA", "PETUGAS"], PENGANGKUT: ["PENGANGKUT"] },
  SERAH_MENGGANTUNG: { KAWASAN: ["PENGELOLA"], PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  PRIORITAS_ANGKUT: { KAWASAN: ["PETUGAS", "PENGELOLA"], PENGANGKUT: ["PENGANGKUT"] },
  WADAH_LEWAT_BATAS: { KAWASAN: ["PETUGAS", "PENGELOLA"] },
  CATATAN_HARIAN_BELUM: { KAWASAN: ["PETUGAS", "PENGELOLA"] },
  KONTRAK_PERLU_KONFIRMASI: { PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  PERMINTAAN_KOREKSI: { KAWASAN: ["PENGELOLA"], PENERIMA: ["PENERIMA"] },
  IZIN_DIPUTUS: { PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  TAGIHAN_TERBIT: { KAWASAN: ["PENGELOLA"] },
  UJI_COBA_BERAKHIR: { KAWASAN: ["PENGELOLA"] },
};

/** Placeholder wajib per jenis (diambil dari teks NTF_<jenis>). */
export function placeholderNotifikasi(jenis: JenisNotifikasi): string[] {
  return [...TEKS[`NTF_${jenis}` as KunciTeks].matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]!);
}

/** Tautan push/email: serah → detail serah; selain itu → pusat notifikasi. */
export function urlNotifikasi(jenis: JenisNotifikasi, objekKode: string): string {
  return jenis.startsWith("SERAH_") ? `/serah/${encodeURIComponent(objekKode)}` : "/notifikasi";
}

export type DataNotifikasi = Record<string, string | number>;

export type NotifikasiBaru = {
  jenis: JenisNotifikasi;
  organisasiId: string | null;
  objekKode: string;
  /** Nilai placeholder NTF_<jenis>; tanpa data pribadi (nama badan usaha, kode, angka, label teks). */
  data: DataNotifikasi;
  /** Opsional: subset peran dari PERAN_TUJUAN (mis. hanya pengurus). Bawaan: semua peran tujuan. */
  peran?: readonly Peran[];
};

// ── Integrasi pengiriman (dapat diganti test) ──────────────────────────────

type Kanal = { push: PengirimPush; email: Pengirim };
let kanalUji: Partial<Kanal> | null = null;

/** Hanya untuk test: ganti pengirim push/email (null = bawaan). */
export function setelKanalNotifikasiUji(k: Partial<Kanal> | null): void {
  kanalUji = k;
}

function kanal(): Kanal {
  const e = muatEnv();
  return {
    push: kanalUji?.push ?? buatPengirimPush(e),
    email: kanalUji?.email ?? buatPengirim({ produksi: e.NODE_ENV === "production", resendApiKey: e.RESEND_API_KEY, emailDari: e.EMAIL_FROM }),
  };
}

// ── Penulis tunggal ────────────────────────────────────────────────────────

/**
 * Tulis notifikasi (satu baris per organisasi) dalam transaksi `tx`, lalu jadwalkan NOTIFY & pengiriman setelah commit.
 * createMany (tanpa RETURNING): pelaku sering menulis untuk organisasi lain yang barisnya tidak boleh ia baca.
 * Mengembalikan jumlah baris yang ditulis (organisasi tanpa peran tujuan untuk jenis ini dilewati).
 */
export async function buatNotifikasi(tx: Tx, daftar: readonly NotifikasiBaru[], sekarang: Date): Promise<number> {
  const target = daftar.filter((x): x is NotifikasiBaru & { organisasiId: string } => x.organisasiId !== null);
  if (target.length === 0) return 0;

  const jenisOrg = await jenisOrganisasi(tx, target.map((x) => x.organisasiId));
  const baris: BarisKirim[] = [];
  for (const x of target) {
    const wajib = placeholderNotifikasi(x.jenis);
    const kurang = wajib.filter((p) => x.data[p] === undefined);
    if (kurang.length > 0) throw new Error(`Notifikasi ${x.jenis}: placeholder ${kurang.join(", ")} tidak diisi`);
    const asing = Object.keys(x.data).filter((k) => !wajib.includes(k));
    if (asing.length > 0) throw new Error(`Notifikasi ${x.jenis}: data di luar placeholder (${asing.join(", ")})`);

    const org = jenisOrg.get(x.organisasiId);
    const peranBoleh = org ? (PERAN_TUJUAN[x.jenis][org] ?? []) : [];
    const peran = x.peran ? x.peran.filter((p) => peranBoleh.includes(p)) : [...peranBoleh];
    if (x.peran && peran.length !== x.peran.length) throw new Error(`Notifikasi ${x.jenis}: peran di luar tujuan untuk ${org}`);
    if (peran.length === 0) continue;
    baris.push({ organisasiId: x.organisasiId, peranTujuan: peran, jenis: x.jenis, objekKode: x.objekKode, data: x.data });
  }
  if (baris.length === 0) return 0;
  await tx.notifikasi.createMany({ data: baris.map((b) => ({ ...b, data: b.data as Prisma.InputJsonValue, dibuatPada: sekarang })) });

  for (const b of baris) {
    // NOTIFY transaksional: hanya terkirim bila commit. Payload tanpa data pribadi.
    await tx.$executeRaw`SELECT pg_notify(${`org_${b.organisasiId}`}, ${JSON.stringify({ t: "notifikasi", jenis: b.jenis, kode: b.objekKode, versi: 0, peran: b.peranTujuan })})`;
  }
  setelahCommit(tx, async () => {
    await kirimKeluar(baris);
  });
  return baris.length;
}

/**
 * Jenis organisasi tujuan, dibaca di bawah RLS pelaku. RLS organisasi membuka: organisasi sendiri, semua PENGANGKUT &
 * PENERIMA (bagi sesi mana pun), dan KAWASAN yang berkontrak dengan pelaku — mencakup semua alur notifikasi.
 * Organisasi yang tidak terbaca dilewati (dicatat tanpa PII), tidak menggagalkan transaksi pelaku.
 */
async function jenisOrganisasi(tx: Tx, ids: readonly string[]): Promise<Map<string, JenisOrganisasi>> {
  const baris = await tx.organisasi.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, jenis: true } });
  const peta = new Map(baris.map((b) => [b.id, b.jenis]));
  if (peta.size < new Set(ids).size) log().warn("notifikasi: organisasi tujuan tidak terbaca, dilewati");
  return peta;
}

// ── Pengiriman keluar (setelah commit) ─────────────────────────────────────

type BarisKirim = { organisasiId: string; peranTujuan: Peran[]; jenis: JenisNotifikasi; objekKode: string; data: DataNotifikasi };

/** Kalimat notifikasi dari teks NTF_<jenis> (§M.11) dengan placeholder terisi. */
export function kalimatNotifikasi(jenis: JenisNotifikasi, data: DataNotifikasi): string {
  return (TEKS[`NTF_${jenis}` as KunciTeks] as string).replace(/{([a-z0-9_]+)}/g, (_m, nama: string) => {
    const v = data[nama];
    if (v === undefined) throw new Error(`Placeholder {${nama}} untuk NTF_${jenis} tidak diisi`);
    return String(v);
  });
}

export type HasilKirim = { push: number; email: number; langgananDihapus: number };

/** Kirim push & email untuk baris notifikasi yang sudah commit. Galat per penerima tidak menghentikan yang lain. */
export async function kirimKeluar(baris: readonly BarisKirim[]): Promise<HasilKirim> {
  const hasil: HasilKirim = { push: 0, email: 0, langgananDihapus: 0 };
  const { push, email } = kanal();
  for (const b of baris) {
    const data = b.data;
    const kunci = `NTF_${b.jenis}` as KunciTeks;
    const kalimat = kalimatNotifikasi(b.jenis, data);
    const url = urlNotifikasi(b.jenis, b.objekKode);

    // Penerima, preferensi, hak, langganan: identitas & lintas organisasi → konteks sistem, transaksi singkat.
    const rencana = await denganSistem(async (tx) => {
      const anggota = await tx.keanggotaan.findMany({
        where: { organisasiId: b.organisasiId, peran: { in: b.peranTujuan }, aktif: true, pengguna: { dihapusPada: null } },
        select: { penggunaId: true, pengguna: { select: { email: true, emailTerverifikasiPada: true } } },
      });
      const penggunaIds = [...new Set(anggota.map((a) => a.penggunaId))];
      const pref = new Map(
        (await tx.preferensiNotifikasi.findMany({ where: { organisasiId: b.organisasiId, penggunaId: { in: penggunaIds } } })).map((p) => [p.penggunaId, p]),
      );
      const bolehPush = await boleh(tx, b.organisasiId, "notifikasi.push");
      const bolehEmail = await boleh(tx, b.organisasiId, "notifikasi.email");
      const langganan = bolehPush
        ? await tx.langgananPush.findMany({ where: { penggunaId: { in: penggunaIds.filter((id) => pref.get(id)?.push ?? true) } } })
        : [];
      const surel = bolehEmail
        ? [
            ...new Set(
              anggota
                .filter((a) => (pref.get(a.penggunaId)?.email ?? true) && a.pengguna.email && a.pengguna.emailTerverifikasiPada)
                .map((a) => a.pengguna.email!),
            ),
          ]
        : [];
      return { langganan, surel };
    });

    const usang: string[] = [];
    for (const l of rencana.langganan) {
      const r = await push.kirim({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } }, { judul: TEKS.APP_NAMA, isi: kalimat, url });
      if (r.ok) hasil.push += 1;
      else if (r.hapusLangganan) usang.push(l.id);
    }
    if (usang.length > 0) {
      hasil.langgananDihapus += await denganSistem(async (tx) => (await tx.langgananPush.deleteMany({ where: { id: { in: usang } } })).count);
    }
    const asal = new URL(muatEnv().BASE_URL).origin;
    for (const ke of rencana.surel) {
      try {
        await email.kirim(susunEmail(ke, templatNotifikasi(kunci, data, `${asal}${url}`)));
        hasil.email += 1;
      } catch {
        log().warn("email notifikasi gagal", { jenis: b.jenis });
      }
    }
  }
  return hasil;
}

// ── API notifikasi in-app (S17-3) ──────────────────────────────────────────
// Terlihat = organisasi aktif sesi (RLS) DAN peran sesi termasuk peran tujuan. Status baca bersifat pribadi.

const BATAS_DAFTAR = 100;

type SesiNotifikasi = { penggunaId: string; organisasiAktifId: string | null; peran: Peran | null };

function sasaran(sesi: SesiNotifikasi): Prisma.NotifikasiWhereInput | null {
  if (!sesi.organisasiAktifId || !sesi.peran) return null;
  return { organisasiId: sesi.organisasiAktifId, peranTujuan: { has: sesi.peran } };
}

export async function daftarNotifikasi(tx: Tx, sesi: SesiNotifikasi, belumDibaca?: boolean) {
  const w = sasaran(sesi);
  if (!w) return { notifikasi: [] };
  const baris = await tx.notifikasi.findMany({
    where: { ...w, ...(belumDibaca ? { dibaca: { none: { penggunaId: sesi.penggunaId } } } : {}) },
    orderBy: [{ dibuatPada: "desc" }, { id: "desc" }],
    take: BATAS_DAFTAR,
    select: { id: true, jenis: true, objekKode: true, data: true, dibuatPada: true, dibaca: { where: { penggunaId: sesi.penggunaId }, select: { penggunaId: true } } },
  });
  return {
    notifikasi: baris.map((n) => ({
      id: n.id,
      jenis: n.jenis,
      objekKode: n.objekKode,
      data: (n.data ?? {}) as Record<string, string | number | boolean | null>,
      dibuatPada: n.dibuatPada.toISOString(),
      dibaca: n.dibaca.length > 0,
    })),
  };
}

export async function bacaNotifikasi(tx: Tx, sesi: SesiNotifikasi, id: string, sekarang: Date) {
  const w = sasaran(sesi);
  const n = w ? await tx.notifikasi.findFirst({ where: { ...w, id }, select: { id: true } }) : null;
  if (!n) throw new GalatApi("TIDAK_DITEMUKAN");
  await tx.notifikasiDibaca.createMany({ data: [{ notifikasiId: id, penggunaId: sesi.penggunaId, dibacaPada: sekarang }], skipDuplicates: true });
  return { id, dibaca: true as const };
}

export async function bacaSemuaNotifikasi(tx: Tx, sesi: SesiNotifikasi, sekarang: Date) {
  const w = sasaran(sesi);
  if (!w) return { jumlah: 0 };
  const belum = await tx.notifikasi.findMany({ where: { ...w, dibaca: { none: { penggunaId: sesi.penggunaId } } }, select: { id: true } });
  if (belum.length === 0) return { jumlah: 0 };
  const r = await tx.notifikasiDibaca.createMany({
    data: belum.map((n) => ({ notifikasiId: n.id, penggunaId: sesi.penggunaId, dibacaPada: sekarang })),
    skipDuplicates: true,
  });
  return { jumlah: r.count };
}

// ── Langganan Web Push (S17-3) ─────────────────────────────────────────────

/**
 * Simpan langganan push milik pengguna sesi. Endpoint unik per peramban: bila endpoint tercatat untuk pengguna lain
 * (pengguna berganti di peramban yang sama), langganan dipindahkan ke pengguna sesi. Baris pengguna lain tidak terlihat
 * (RLS), jadi pemindahan dilakukan di konteks sistem setelah commit; pemohon membuktikan kepemilikan dengan memegang
 * endpoint & kunci peramban itu.
 */
export async function simpanLanggananPush(tx: Tx, penggunaId: string, m: { endpoint: string; keys: { p256dh: string; auth: string } }, sekarang: Date) {
  const milik = await tx.langgananPush.findUnique({ where: { endpoint: m.endpoint }, select: { id: true } });
  if (milik) {
    await tx.langgananPush.update({ where: { id: milik.id }, data: { p256dh: m.keys.p256dh, auth: m.keys.auth } });
    return { ok: true as const };
  }
  setelahCommit(tx, async () => {
    await denganSistem(async (s) => {
      await s.langgananPush.deleteMany({ where: { endpoint: m.endpoint, NOT: { penggunaId } } });
      await s.langgananPush.createMany({ data: [{ penggunaId, endpoint: m.endpoint, p256dh: m.keys.p256dh, auth: m.keys.auth, dibuatPada: sekarang }], skipDuplicates: true });
    });
  });
  return { ok: true as const };
}

export async function hapusLanggananPush(tx: Tx, penggunaId: string, endpoint: string) {
  await tx.langgananPush.deleteMany({ where: { endpoint, penggunaId } });
  return { ok: true as const };
}

export function kunciPublikPush() {
  return { kunciPublik: muatEnv().VAPID_PUBLIC_KEY || null };
}
