import type { AkunDataSayaKeluaran, AnggotaDaftarKeluaran } from "@serah/kontrak";
import type { z } from "zod";
import { wajibPengurusAktif } from "./auth";
import { denganAkses, larikPg, type Tx } from "./db";
import { GalatApi } from "./galat";
import { cabutSemuaSesi, konteksAkses, type Sesi } from "./sesi";

// Akun pribadi & anggota organisasi (S07). Hak subjek PDP: unduh data, tarik persetujuan, hapus akun.

/** Konteks "diri sendiri": tabel identitas milik pengguna terbaca lewat app.pengguna_id; org_ids = organisasi keanggotaannya. */
async function konteksDiri(tx: Tx, penggunaId: string): Promise<string[]> {
  const anggota = await tx.keanggotaan.findMany({ where: { penggunaId }, select: { organisasiId: true } });
  const ids = [...new Set(anggota.map((a) => a.organisasiId))];
  await tx.$queryRaw`SELECT set_config('app.org_ids', ${larikPg(ids)}, true)`;
  return ids;
}

export async function dataSaya(sesi: Sesi): Promise<z.infer<typeof AkunDataSayaKeluaran>> {
  return denganAkses({ penggunaId: sesi.penggunaId, orgIds: [], peran: null }, async (tx) => {
    await konteksDiri(tx, sesi.penggunaId);
    const p = await tx.pengguna.findUnique({ where: { id: sesi.penggunaId } });
    if (!p?.email) throw new GalatApi("TIDAK_DITEMUKAN");
    const anggota = await tx.keanggotaan.findMany({
      where: { penggunaId: sesi.penggunaId },
      include: { organisasi: { select: { nama: true } } },
      orderBy: { dibuatPada: "asc" },
    });
    const persetujuan = await tx.persetujuanPdp.findMany({ where: { penggunaId: sesi.penggunaId }, orderBy: { pada: "asc" } });
    const preferensi = await tx.preferensiNotifikasi.findMany({ where: { penggunaId: sesi.penggunaId } });
    const push = await tx.langgananPush.findMany({ where: { penggunaId: sesi.penggunaId } });
    return {
      pengguna: {
        id: p.id,
        email: p.email,
        emailTerverifikasiPada: p.emailTerverifikasiPada?.toISOString() ?? null,
        dibuatPada: p.dibuatPada.toISOString(),
      },
      keanggotaan: anggota.map((a) => ({
        organisasiId: a.organisasiId,
        organisasiNama: a.organisasi.nama,
        peran: a.peran,
        pengurus: a.pengurus,
        aktif: a.aktif,
        sejak: a.dibuatPada.toISOString(),
      })),
      persetujuan: persetujuan.map((x) => ({ versi: x.versi, jenis: x.jenis, pada: x.pada.toISOString() })),
      preferensiNotifikasi: preferensi.map((x) => ({ organisasiId: x.organisasiId, email: x.email, push: x.push })),
      langgananPush: push.map((x) => ({ endpoint: x.endpoint, dibuatPada: x.dibuatPada.toISOString() })),
    };
  });
}

/** Tarik persetujuan = baris baru TARIK (catatan lama tetap), lalu semua sesi dicabut. */
export async function tarikPersetujuan(sesi: Sesi, sekarang: Date = new Date()): Promise<void> {
  await denganAkses({ penggunaId: sesi.penggunaId, orgIds: [], peran: null }, async (tx) => {
    const terakhir = await tx.persetujuanPdp.findFirst({ where: { penggunaId: sesi.penggunaId }, orderBy: { pada: "desc" } });
    if (!terakhir) throw new GalatApi("TIDAK_DITEMUKAN");
    await tx.persetujuanPdp.create({ data: { penggunaId: sesi.penggunaId, versi: terakhir.versi, jenis: "TARIK", pada: sekarang } });
    await cabutSemuaSesi(tx, sesi.penggunaId, sekarang);
  });
}

/**
 * Hapus akun (T31): email & sandi_hash dikosongkan permanen, sesi dicabut, keanggotaan nonaktif, data pribadi
 * turunan (langganan push, preferensi, status baca, token) dihapus. Data operasional tidak disentuh — tidak memuat identitas.
 */
export async function hapusAkun(sesi: Sesi, sekarang: Date = new Date()): Promise<void> {
  await denganAkses({ penggunaId: sesi.penggunaId, orgIds: [], peran: null }, async (tx) => {
    const id = sesi.penggunaId;
    await tx.pengguna.update({ where: { id }, data: { email: null, sandiHash: null, dihapusPada: sekarang } });
    await tx.keanggotaan.updateMany({ where: { penggunaId: id }, data: { aktif: false } });
    await tx.langgananPush.deleteMany({ where: { penggunaId: id } });
    await tx.preferensiNotifikasi.deleteMany({ where: { penggunaId: id } });
    await tx.notifikasiDibaca.deleteMany({ where: { penggunaId: id } });
    await tx.tokenSekali.deleteMany({ where: { penggunaId: id } });
    await cabutSemuaSesi(tx, id, sekarang);
  });
}

// ── Preferensi notifikasi ──────────────────────────────────────────────────

export type Preferensi = { organisasiId: string; email: boolean; push: boolean };

/** Satu baris per organisasi keanggotaan aktif; bawaan email & push menyala bila belum diatur. */
export async function bacaPreferensi(sesi: Sesi): Promise<Preferensi[]> {
  return denganAkses({ penggunaId: sesi.penggunaId, orgIds: [], peran: null }, async (tx) => {
    const anggota = await tx.keanggotaan.findMany({ where: { penggunaId: sesi.penggunaId, aktif: true }, select: { organisasiId: true } });
    const tersimpan = await tx.preferensiNotifikasi.findMany({ where: { penggunaId: sesi.penggunaId } });
    const per = new Map(tersimpan.map((x) => [x.organisasiId, x]));
    return [...new Set(anggota.map((a) => a.organisasiId))].map((organisasiId) => ({
      organisasiId,
      email: per.get(organisasiId)?.email ?? true,
      push: per.get(organisasiId)?.push ?? true,
    }));
  });
}

export async function ubahPreferensi(sesi: Sesi, p: Preferensi): Promise<Preferensi[]> {
  await denganAkses({ penggunaId: sesi.penggunaId, orgIds: [], peran: null }, async (tx) => {
    const anggota = await tx.keanggotaan.findFirst({
      where: { penggunaId: sesi.penggunaId, organisasiId: p.organisasiId, aktif: true },
      select: { id: true },
    });
    if (!anggota) throw new GalatApi("TIDAK_DITEMUKAN");
    await tx.preferensiNotifikasi.upsert({
      where: { penggunaId_organisasiId: { penggunaId: sesi.penggunaId, organisasiId: p.organisasiId } },
      create: { penggunaId: sesi.penggunaId, organisasiId: p.organisasiId, email: p.email, push: p.push },
      update: { email: p.email, push: p.push },
    });
  });
  return bacaPreferensi(sesi);
}

// ── Anggota organisasi (pengurus) ──────────────────────────────────────────

/** Daftar anggota organisasi aktif: peran, sejak, aktif — TANPA email atau identitas lain. */
export async function daftarAnggota(sesi: Sesi): Promise<z.infer<typeof AnggotaDaftarKeluaran>> {
  return denganAkses(konteksAkses(sesi), async (tx) => {
    const organisasiId = await wajibPengurusAktif(tx, sesi);
    const anggota = await tx.keanggotaan.findMany({
      where: { organisasiId },
      select: { id: true, peran: true, pengurus: true, aktif: true, dibuatPada: true },
      orderBy: { dibuatPada: "asc" },
    });
    return { anggota: anggota.map((a) => ({ id: a.id, peran: a.peran, pengurus: a.pengurus, aktif: a.aktif, sejak: a.dibuatPada.toISOString() })) };
  });
}

export async function nonaktifkanAnggota(sesi: Sesi, keanggotaanId: string): Promise<{ id: string; aktif: false }> {
  return denganAkses(konteksAkses(sesi), async (tx) => {
    const organisasiId = await wajibPengurusAktif(tx, sesi);
    const a = await tx.keanggotaan.findFirst({ where: { id: keanggotaanId, organisasiId }, select: { id: true, penggunaId: true } });
    if (!a) throw new GalatApi("TIDAK_DITEMUKAN");
    if (a.penggunaId === sesi.penggunaId) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["id"], kode: "diri_sendiri" }] });
    await tx.keanggotaan.update({ where: { id: a.id }, data: { aktif: false } });
    return { id: a.id, aktif: false as const };
  });
}

