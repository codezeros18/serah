import { kodeTagihan } from "@serah/core/kode";
import { ditagihBulanan, jatuhTempo, setelahLunas, tanggalSatuWib, tinjauWaktu, totalTagihan } from "@serah/core/langganan";
import { periodeWib, tanggalWib } from "@serah/core/waktu";
import type { StatusLangganan, StatusTagihan } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { hakPaket, PAKET_BERBAYAR, paketOrganisasi } from "../hak";
import { nomorBerikut } from "../penomoran";
import { buatNotifikasi } from "../notifikasi";

// Layanan langganan (S19-2/3). Status langganan HANYA berubah di sini, selalu bersama baris peristiwa_langganan.
// Pemicu: cron harian (waktu) dan pelunasan tagihan (webhook terverifikasi / konfirmasi admin teraudit).

type BarisLangganan = {
  id: string;
  organisasiId: string;
  paketKode: string;
  status: StatusLangganan;
  ujiCobaSelesai: Date | null;
  hargaDibekukanPerTpsIdr: number | null;
};

async function alihkan(tx: Tx, l: BarisLangganan, ke: StatusLangganan, sebab: string, sekarang: Date, data: Partial<{ paketKode: string; hargaDibekukanPerTpsIdr: number; periodeBerjalan: string }> = {}) {
  await tx.langganan.update({ where: { id: l.id }, data: { status: ke, diperbaruiPada: sekarang, ...data } });
  await tx.peristiwaLangganan.create({ data: { langgananId: l.id, dari: l.status, ke, sebab, dibuatPada: sekarang } });
}

/** 700000 → "700.000" (pemisah ribuan Indonesia, tanpa bergantung ICU). */
const ribuan = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Harga per TPS untuk tagihan: harga beku langganan, atau harga paket berbayar saat ini (tagihan pertama). */
async function hargaTagihan(tx: Tx, l: BarisLangganan): Promise<number> {
  if (l.hargaDibekukanPerTpsIdr !== null) return l.hargaDibekukanPerTpsIdr;
  const p = await tx.paket.findUnique({ where: { kode: PAKET_BERBAYAR }, select: { hargaPerTpsIdr: true } });
  if (!p) throw new GalatApi("GALAT_SERVER");
  return p.hargaPerTpsIdr;
}

/**
 * Terbitkan tagihan periode WIB `sekarang` untuk satu langganan: jumlah TPS aktif × harga (tanpa prorata, K-10),
 * jatuh tempo +14 hari. Satu tagihan per organisasi per periode; tanpa TPS aktif → tidak ada tagihan.
 */
export async function terbitkanTagihan(tx: Tx, l: BarisLangganan, sekarang: Date): Promise<{ nomor: string; totalIdr: number } | null> {
  const periode = periodeWib(sekarang);
  if (await tx.tagihan.findFirst({ where: { organisasiId: l.organisasiId, periode }, select: { id: true } })) return null;
  const jumlahTps = await tx.tps.count({ where: { organisasiId: l.organisasiId, aktif: true } });
  if (jumlahTps === 0) return null;
  const harga = await hargaTagihan(tx, l);
  const totalIdr = totalTagihan(jumlahTps, harga);
  const kode = kodeTagihan(periode, await nomorBerikut(tx, "TGH", periode));
  if (!kode.ok) throw new GalatApi("GALAT_SERVER");
  await tx.tagihan.create({
    data: {
      nomor: kode.kode,
      organisasiId: l.organisasiId,
      periode,
      jumlahTps,
      hargaPerTpsIdr: harga,
      totalIdr,
      status: "TERBIT",
      jatuhTempo: new Date(`${jatuhTempo(sekarang)}T00:00:00.000Z`),
      dibuatPada: sekarang,
    },
  });
  await buatNotifikasi(tx, [{ organisasiId: l.organisasiId, jenis: "TAGIHAN_TERBIT", objekKode: kode.kode, data: { nomor: kode.kode, jumlah: ribuan(totalIdr) } }], sekarang);
  return { nomor: kode.kode, totalIdr };
}

const PILIH = { id: true, organisasiId: true, paketKode: true, status: true, ujiCobaSelesai: true, hargaDibekukanPerTpsIdr: true } as const;

/**
 * Cron harian: (1) peralihan karena waktu (uji coba berakhir → BERAKHIR + tagihan pertama; lewat jatuh tempo →
 * MENUNGGAK; tenggang habis → BERAKHIR), (2) tagihan bulanan pada tanggal 1 WIB. Idempoten: diulang tidak menggandakan.
 * `hanyaOrganisasi` membatasi ke organisasi tertentu (uji & pemicu manual).
 */
export async function kerjaLanggananHarian(tx: Tx, sekarang: Date, hanyaOrganisasi?: readonly string[]): Promise<{ peralihan: number; tagihanTerbit: number }> {
  let peralihan = 0;
  let tagihanTerbit = 0;
  const filter = hanyaOrganisasi ? { organisasiId: { in: [...hanyaOrganisasi] } } : {};
  const semua = await tx.langganan.findMany({ where: filter, select: PILIH });
  // Satu kueri untuk semua tagihan terbuka (bukan satu per langganan).
  const terbukaPerOrg = new Map<string, { status: StatusTagihan; jatuhTempo: string }[]>();
  for (const t of await tx.tagihan.findMany({ where: { ...filter, status: { in: ["TERBIT", "KEDALUWARSA", "MENUNGGU_KONFIRMASI"] } }, select: { organisasiId: true, status: true, jatuhTempo: true } })) {
    const daftar = terbukaPerOrg.get(t.organisasiId) ?? [];
    daftar.push({ status: t.status, jatuhTempo: t.jatuhTempo.toISOString().slice(0, 10) });
    terbukaPerOrg.set(t.organisasiId, daftar);
  }
  for (const l of semua) {
    const p = tinjauWaktu(l, terbukaPerOrg.get(l.organisasiId) ?? [], sekarang);
    if (p) {
      await alihkan(tx, l, p.ke, p.sebab, sekarang);
      peralihan++;
      if (p.sebab === "UJI_COBA_BERAKHIR") {
        await buatNotifikasi(tx, [{ organisasiId: l.organisasiId, jenis: "UJI_COBA_BERAKHIR", objekKode: l.id, data: { tanggal: tanggalWib(new Date((l.ujiCobaSelesai?.getTime() ?? sekarang.getTime()) - 1)) } }], sekarang);
        // Tagihan pertama agar kawasan dapat langsung berlangganan.
        if (await terbitkanTagihan(tx, { ...l, status: p.ke }, sekarang)) tagihanTerbit++;
      }
    }
    if (tanggalSatuWib(sekarang) && ditagihBulanan(p?.ke ?? l.status) && (await terbitkanTagihan(tx, l, sekarang))) tagihanTerbit++;
  }
  return { peralihan, tagihanTerbit };
}

/** Tagihan lunas → langganan AKTIF pada paket berbayar; harga dibekukan saat pertama AKTIF (core/langganan.setelahLunas). */
export async function aktifkanSetelahLunas(tx: Tx, organisasiId: string, hargaTagihanPerTpsIdr: number, sekarang: Date, sebab: string): Promise<void> {
  const l = await tx.langganan.findUnique({ where: { organisasiId }, select: PILIH });
  if (!l) return;
  const h = setelahLunas(l, hargaTagihanPerTpsIdr, sekarang);
  await alihkan(tx, l, h.status, sebab, sekarang, { paketKode: PAKET_BERBAYAR, hargaDibekukanPerTpsIdr: h.hargaDibekukanPerTpsIdr, periodeBerjalan: h.periodeBerjalan });
}

/** GET /api/langganan — paket EFEKTIF (uji coba lewat → dasar walau cron belum jalan), status, TPS yang akan ditagih. */
export async function bacaLangganan(tx: Tx, organisasiId: string, sekarang: Date) {
  const l = await tx.langganan.findUnique({ where: { organisasiId } });
  if (!l) throw new GalatApi("TIDAK_DITEMUKAN");
  return {
    paketKode: await paketOrganisasi(tx, { id: organisasiId, jenis: "KAWASAN" }, sekarang),
    status: l.status,
    // Hari terakhir uji coba (selesai = tengah malam WIB sesudahnya).
    ujiCobaSelesai: l.ujiCobaSelesai ? tanggalWib(new Date(l.ujiCobaSelesai.getTime() - 1)) : null,
    hargaDibekukanPerTpsIdr: l.hargaDibekukanPerTpsIdr,
    periodeBerjalan: l.periodeBerjalan,
    tpsDitagih: await tx.tps.count({ where: { organisasiId, aktif: true } }),
  };
}

/** GET /api/paket — katalog paket aktif beserta haknya (publik; harga & hak adalah data, bukan literal kode). */
export async function daftarPaket(tx: Tx) {
  const semua = await tx.paket.findMany({ where: { aktif: true }, orderBy: { urutan: "asc" } });
  return Promise.all(semua.map(async (p) => ({ kode: p.kode, urutan: p.urutan, hargaPerTpsIdr: p.hargaPerTpsIdr, berlakuUntuk: p.berlakuUntuk, aktif: p.aktif, hak: await hakPaket(tx, p.kode) })));
}
