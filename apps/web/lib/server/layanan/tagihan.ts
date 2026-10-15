import type { Prisma } from "@serah/db";
import type { StatusTagihan, Tagihan } from "@serah/kontrak";
import { penyediaBayar, type HasilStatus, type PenyediaBayar } from "../../adaptor/bayar";
import { wajibPengurusAktif } from "../auth";
import { denganAkses, denganSistem, type Tx } from "../db";
import { muatEnv } from "../env";
import { GalatApi } from "../galat";
import { konteksAkses, type Sesi } from "../sesi";
import { aktifkanSetelahLunas } from "./langganan";

// Layanan tagihan & pembayaran (S19-4/5/6). Status tagihan HANYA berubah dari (a) status penyedia yang ditarik ulang
// setelah notifikasi bertanda tangan sah, (b) konfirmasi admin teraudit (S21), (c) unggah bukti transfer
// (→ MENUNGGU_KONFIRMASI). Setiap kejadian dicatat di peristiwa_bayar (catat-saja, unik per penyedia+kunci).
// Kejanggalan (uang ganda, nominal beda, bayar terlambat, pengembalian) TIDAK ditolak diam-diam: status tagihan tetap
// dan satu baris `PERLU_TINJAUAN` masuk antrean admin.

export const JENIS_PERLU_TINJAUAN = "PERLU_TINJAUAN";

type BarisTagihan = {
  id: string;
  nomor: string;
  organisasiId: string;
  periode: string;
  jumlahTps: number;
  hargaPerTpsIdr: number;
  totalIdr: number;
  status: StatusTagihan;
  jatuhTempo: Date;
  dibuatPada: Date;
};

export function keDtoTagihan(t: BarisTagihan): Tagihan {
  return {
    id: t.id,
    nomor: t.nomor as Tagihan["nomor"],
    periode: t.periode,
    jumlahTps: t.jumlahTps,
    hargaPerTpsIdr: t.hargaPerTpsIdr,
    totalIdr: t.totalIdr,
    status: t.status,
    jatuhTempo: t.jatuhTempo.toISOString().slice(0, 10),
    dibuatPada: t.dibuatPada.toISOString(),
  };
}

function penyedia(): PenyediaBayar | null {
  return penyediaBayar({ serverKey: muatEnv().MIDTRANS_SERVER_KEY });
}

type CatatanPeristiwa = { penyedia: "MIDTRANS" | "MANUAL"; kunci: string; tagihanId: string | null; jenis: string; jumlahIdr: number | null; payload: Record<string, unknown> };

/** INSERT tanpa RETURNING (penyedia/organisasi lain mungkin tak boleh membaca); true bila baris baru, false bila duplikat. */
async function catatPeristiwa(tx: Tx, c: CatatanPeristiwa, sekarang: Date): Promise<boolean> {
  const r = await tx.peristiwaBayar.createMany({
    data: [{ penyedia: c.penyedia, kunciPeristiwa: c.kunci, tagihanId: c.tagihanId, jenis: c.jenis, jumlahIdr: c.jumlahIdr, payload: c.payload as Prisma.InputJsonValue, terverifikasi: true, diterimaPada: sekarang }],
    skipDuplicates: true,
  });
  return r.count === 1;
}

async function tandaiTinjauan(tx: Tx, t: BarisTagihan, sebab: string, h: HasilStatus | null, sekarang: Date, penyediaNama: "MIDTRANS" | "MANUAL" = "MIDTRANS") {
  await catatPeristiwa(
    tx,
    {
      penyedia: penyediaNama,
      kunci: `tinjau:${sebab}:${t.nomor}:${h?.idTransaksi ?? "-"}`,
      tagihanId: t.id,
      jenis: JENIS_PERLU_TINJAUAN,
      jumlahIdr: h?.jumlahIdr ?? null,
      payload: { sebab, statusTagihan: t.status, totalIdr: t.totalIdr, jumlahIdr: h?.jumlahIdr ?? null, idTransaksi: h?.idTransaksi ?? null },
    },
    sekarang,
  );
}

// ── Baca ───────────────────────────────────────────────────────────────────

async function orgKawasanPengurus(tx: Tx, sesi: Sesi): Promise<string> {
  const id = await wajibPengurusAktif(tx, sesi);
  const o = await tx.organisasi.findUnique({ where: { id }, select: { jenis: true } });
  if (o?.jenis !== "KAWASAN") throw new GalatApi("PERAN_TIDAK_BOLEH");
  return id;
}

export async function daftarTagihan(sesi: Sesi): Promise<Tagihan[]> {
  return denganAkses(konteksAkses(sesi), async (tx) => {
    const org = await orgKawasanPengurus(tx, sesi);
    const baris = await tx.tagihan.findMany({ where: { organisasiId: org }, orderBy: { dibuatPada: "desc" } });
    return baris.map(keDtoTagihan);
  });
}

async function muatTagihanMilik(tx: Tx, sesi: Sesi, nomor: string): Promise<BarisTagihan> {
  const org = await orgKawasanPengurus(tx, sesi);
  const t = await tx.tagihan.findUnique({ where: { nomor } });
  if (!t || t.organisasiId !== org) throw new GalatApi("TIDAK_DITEMUKAN");
  return t;
}

// ── Terapkan status penyedia (dipakai webhook & tarik manual) ─────────────

/**
 * Terapkan status yang DITARIK dari penyedia ke tagihan (dalam transaksi sistem). Hanya LUNAS dengan nominal tepat
 * pada tagihan TERBIT/MENUNGGU_KONFIRMASI yang mengubah tagihan menjadi LUNAS dan mengaktifkan langganan.
 */
export async function terapkanStatus(tx: Tx, tagihanId: string, h: HasilStatus, sekarang: Date): Promise<StatusTagihan> {
  const t = await tx.tagihan.findUnique({ where: { id: tagihanId } });
  if (!t) return "TERBIT";
  switch (h.status) {
    case "LUNAS": {
      if (t.status === "LUNAS") {
        const lunas = await tx.peristiwaBayar.findFirst({ where: { tagihanId, jenis: "TAGIHAN_LUNAS" }, select: { payload: true } });
        const idLunas = (lunas?.payload as { idTransaksi?: string } | null)?.idTransaksi ?? null;
        if (idLunas !== null && idLunas !== h.idTransaksi) await tandaiTinjauan(tx, t, "BAYAR_GANDA", h, sekarang);
        return t.status;
      }
      if (t.status === "KEDALUWARSA" || t.status === "DIBATALKAN") {
        await tandaiTinjauan(tx, t, "BAYAR_TERLAMBAT", h, sekarang);
        return t.status;
      }
      if (h.jumlahIdr !== t.totalIdr) {
        await tandaiTinjauan(tx, t, h.jumlahIdr !== null && h.jumlahIdr > t.totalIdr ? "BAYAR_LEBIH" : "BAYAR_BERBEDA", h, sekarang);
        return t.status;
      }
      await tx.tagihan.update({ where: { id: t.id }, data: { status: "LUNAS" } });
      await catatPeristiwa(tx, { penyedia: "MIDTRANS", kunci: `lunas:${t.nomor}`, tagihanId: t.id, jenis: "TAGIHAN_LUNAS", jumlahIdr: h.jumlahIdr, payload: { idTransaksi: h.idTransaksi } }, sekarang);
      await aktifkanSetelahLunas(tx, t.organisasiId, t.hargaPerTpsIdr, sekarang, `tagihan ${t.nomor} lunas`);
      return "LUNAS";
    }
    case "KEDALUWARSA":
      if (t.status === "TERBIT") {
        await tx.tagihan.update({ where: { id: t.id }, data: { status: "KEDALUWARSA" } });
        return "KEDALUWARSA";
      }
      return t.status;
    case "DIKEMBALIKAN":
      await tandaiTinjauan(tx, t, "DIKEMBALIKAN", h, sekarang);
      return t.status;
    default:
      // MENUNGGU, GAGAL (cancel/deny/failure → tetap TERBIT), TIDAK_ADA: tidak mengubah apa pun.
      return t.status;
  }
}

// ── Bayar online ───────────────────────────────────────────────────────────

/** Buat pembayaran online (sandbox). Idempoten per tagihan: pembayaran yang sudah dibuat dikembalikan lagi. */
export async function bayarOnline(sesi: Sesi, nomor: string, sekarang: Date = new Date()): Promise<{ snapToken: string; redirectUrl: string }> {
  const p = penyedia();
  if (!p) throw new GalatApi("TIDAK_DITEMUKAN"); // tanpa kunci penyedia: hanya transfer manual (§Q)
  const t = await denganAkses(konteksAkses(sesi), async (tx) => {
    const t = await muatTagihanMilik(tx, sesi, nomor);
    if (t.status !== "TERBIT") throw new GalatApi("TRANSISI_TIDAK_SAH");
    const ada = await tx.peristiwaBayar.findUnique({ where: { penyedia_kunciPeristiwa: { penyedia: "MIDTRANS", kunciPeristiwa: `bayar:${nomor}` } }, select: { payload: true } });
    return { t, ada: ada?.payload as { token: string; urlBayar: string } | undefined };
  });
  if (t.ada) return { snapToken: t.ada.token, redirectUrl: t.ada.urlBayar };
  // Jaringan di luar transaksi DB.
  const hasil = await p.buatPembayaran({ nomorTagihan: nomor, totalIdr: t.t.totalIdr });
  await denganAkses(konteksAkses(sesi), (tx) =>
    catatPeristiwa(tx, { penyedia: "MIDTRANS", kunci: `bayar:${nomor}`, tagihanId: t.t.id, jenis: "PEMBAYARAN_DIBUAT", jumlahIdr: t.t.totalIdr, payload: hasil }, sekarang),
  );
  return { snapToken: hasil.token, redirectUrl: hasil.urlBayar };
}

/** GET /api/tagihan/[nomor]/status — tarik status ke penyedia secara manual (notifikasi hilang). */
export async function tarikStatusManual(sesi: Sesi, nomor: string, sekarang: Date = new Date()): Promise<Tagihan> {
  const t = await denganAkses(konteksAkses(sesi), (tx) => muatTagihanMilik(tx, sesi, nomor));
  const p = penyedia();
  if (p && (t.status === "TERBIT" || t.status === "LUNAS")) {
    const h = await p.tarikStatus(nomor);
    await denganSistem((tx) => terapkanStatus(tx, t.id, h, sekarang));
  }
  return denganAkses(konteksAkses(sesi), async (tx) => keDtoTagihan(await muatTagihanMilik(tx, sesi, nomor)));
}

// ── Webhook ────────────────────────────────────────────────────────────────

export type HasilWebhook = { status: "TIDAK_SAH" } | { status: "TERCATAT"; duplikat: boolean };

/**
 * Notifikasi penyedia: (1) verifikasi tanda tangan — gagal → TIDAK_SAH tanpa menyimpan apa pun; (2) catat peristiwa
 * idempoten; (3) tarik status ke Get Status API (isi notifikasi tidak dipercaya); (4) terapkan. Langkah 3–4 gagal
 * tidak membatalkan pencatatan: respons tetap 200, status dapat ditarik ulang lewat GET …/status.
 */
export async function terimaNotifikasi(isi: Record<string, unknown>, sekarang: Date = new Date()): Promise<HasilWebhook> {
  const p = penyedia();
  const n = p?.verifikasiNotifikasi(isi) ?? null;
  if (!p || !n) return { status: "TIDAK_SAH" };
  const dicatat = await denganSistem(async (tx) => {
    const t = await tx.tagihan.findUnique({ where: { nomor: n.nomorTagihan }, select: { id: true } });
    const baru = await catatPeristiwa(tx, { penyedia: "MIDTRANS", kunci: n.kunciPeristiwa, tagihanId: t?.id ?? null, jenis: n.jenis, jumlahIdr: n.jumlahIdr, payload: n.mentah }, sekarang);
    return { baru, tagihanId: t?.id ?? null };
  });
  if (!dicatat.baru) return { status: "TERCATAT", duplikat: true };
  if (dicatat.tagihanId) {
    try {
      const h = await p.tarikStatus(n.nomorTagihan);
      const tagihanId = dicatat.tagihanId;
      await denganSistem((tx) => terapkanStatus(tx, tagihanId, h, sekarang));
    } catch (e) {
      process.stderr.write(`[serah] tarik status pembayaran gagal: ${e instanceof Error ? e.name : "unknown"}\n`);
    }
  }
  return { status: "TERCATAT", duplikat: false };
}

// ── Transfer manual ────────────────────────────────────────────────────────

/** Unggah bukti transfer → MENUNGGU_KONFIRMASI (konfirmasi admin teraudit di S21). Tanpa TRANSFER_REKENING_TEKS → 404. */
export async function kirimBuktiTransfer(sesi: Sesi, nomor: string, fotoBuktiId: string, sekarang: Date = new Date()): Promise<Tagihan> {
  if (!muatEnv().TRANSFER_REKENING_TEKS) throw new GalatApi("TIDAK_DITEMUKAN");
  return denganAkses(konteksAkses(sesi), async (tx) => {
    const t = await muatTagihanMilik(tx, sesi, nomor);
    if (t.status !== "TERBIT" && t.status !== "KEDALUWARSA") throw new GalatApi("TRANSISI_TIDAK_SAH");
    const f = await tx.foto.findUnique({ where: { id: fotoBuktiId }, select: { jenis: true, organisasiId: true } });
    if (!f || f.jenis !== "BUKTI_TRANSFER" || f.organisasiId !== t.organisasiId) {
      throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["fotoBuktiId"], kode: "bukan_bukti_transfer_organisasi_ini" }] });
    }
    await catatPeristiwa(tx, { penyedia: "MANUAL", kunci: `transfer:${nomor}:${fotoBuktiId}`, tagihanId: t.id, jenis: "BUKTI_TRANSFER", jumlahIdr: null, payload: { fotoBuktiId } }, sekarang);
    const baru = await tx.tagihan.update({ where: { id: t.id }, data: { status: "MENUNGGU_KONFIRMASI" } });
    return keDtoTagihan(baru);
  });
}
