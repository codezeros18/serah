import { kedaluwarsaToken, normalisasiEmail, peranCocokJenis, persetujuanBerlaku, pilihKonteksAwal, statusToken } from "@serah/core/akun";
import type { AuthMasukKeluaran, Peran } from "@serah/kontrak";
import type { z } from "zod";
import { buatPengirim } from "../adaptor/email";
import { susunEmail, templatReset, templatUndangan, templatVerifikasi } from "../adaptor/email/templat";
import { hitungBatasLaju, wajibDalamBatas } from "./batas-laju";
import { denganAkses, denganAuth, type Tx } from "./db";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";
import { log } from "./log";
import { idBaru } from "./id";
import { cocokSandi, hashSandi } from "./sandi";
import { buatSesi, cabutSemuaSesi, konteksAkses, organisasiPengguna, type Sesi } from "./sesi";
import { buatToken, hashEmail, hashIp, hashToken } from "./token";

// Layanan autentikasi (S07): daftar, verifikasi email, masuk, lupa & reset sandi, undangan.
// Email selalu dikirim SETELAH transaksi berhasil.

function pengirim() {
  const e = muatEnv();
  return buatPengirim({ produksi: e.NODE_ENV === "production", resendApiKey: e.RESEND_API_KEY, emailDari: e.EMAIL_FROM });
}

function tautan(jalur: string, token: string): string {
  const u = new URL(jalur, muatEnv().BASE_URL);
  u.searchParams.set("token", token);
  return u.toString();
}

/**
 * Persetujuan PDP dicatat SEBELUM baris pengguna dibuat, dalam transaksi yang sama (CLAUDE.md §2.5).
 * FK persetujuan_pdp → pengguna DEFERRABLE INITIALLY DEFERRED (diperiksa saat COMMIT).
 */
export async function buatPenggunaDenganPersetujuan(
  tx: Tx,
  d: { id: string; email: string; sandiHash: string; versi: string; terverifikasiPada: Date | null; sekarang: Date },
): Promise<void> {
  await tx.persetujuanPdp.create({ data: { penggunaId: d.id, versi: d.versi, jenis: "LAYANAN", pada: d.sekarang } });
  await tx.pengguna.create({
    data: { id: d.id, email: d.email, sandiHash: d.sandiHash, emailTerverifikasiPada: d.terverifikasiPada, dibuatPada: d.sekarang },
  });
}

async function wajibTeksPersetujuan(tx: Tx, versi: string): Promise<void> {
  const ada = await tx.teksPersetujuan.findUnique({ where: { versi }, select: { versi: true } });
  if (!ada) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["persetujuanVersi"], kode: "tidak_dikenal" }] });
}

/** Tandai token dipakai secara atomik (kiriman ganda → hanya satu yang menang). */
async function klaimToken(tx: Tx, id: string, sekarang: Date): Promise<boolean> {
  const r = await tx.tokenSekali.updateMany({ where: { id, dipakaiPada: null }, data: { dipakaiPada: sekarang } });
  return r.count === 1;
}

// ── Daftar & verifikasi ────────────────────────────────────────────────────

export async function daftar(m: { email: string; sandi: string; persetujuanVersi: string }, ip: string, sekarang: Date = new Date()): Promise<void> {
  await wajibDalamBatas("DAFTAR", hashIp(ip), sekarang);
  const email = normalisasiEmail(m.email);
  const sandiHash = await hashSandi(m.sandi);
  const token = buatToken();
  const demo = muatEnv().DEMO_MODE && muatEnv().DAFTAR_LANGSUNG_AKTIF;
  const baru = await denganAuth(async (tx) => {
    await wajibTeksPersetujuan(tx, m.persetujuanVersi);
    // Email sudah terdaftar → respons tetap sama (tidak membocorkan keberadaan akun), tanpa membuat apa pun.
    if (await tx.pengguna.findUnique({ where: { email }, select: { id: true } })) return false;
    const id = idBaru();
    // Mode demo: email verifikasi tidak bisa dikirim ke alamat sembarang (domain pengirim belum terverifikasi) → langsung terverifikasi.
    await buatPenggunaDenganPersetujuan(tx, { id, email, sandiHash, versi: m.persetujuanVersi, terverifikasiPada: demo ? sekarang : null, sekarang });
    if (demo) return false;
    await tx.tokenSekali.create({
      data: {
        jenis: "VERIFIKASI_EMAIL",
        tokenHash: hashToken(token),
        penggunaId: id,
        emailTujuanHash: hashEmail(email),
        kedaluwarsaPada: kedaluwarsaToken("VERIFIKASI_EMAIL", sekarang),
      },
    });
    return true;
  });
  if (baru) await pengirim().kirim(susunEmail(email, templatVerifikasi(tautan("/verifikasi", token))));
}

export async function verifikasiEmail(token: string, sekarang: Date = new Date()): Promise<void> {
  const ok = await denganAuth(async (tx) => {
    const t = await tx.tokenSekali.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!t || t.jenis !== "VERIFIKASI_EMAIL" || !t.penggunaId || statusToken(t, sekarang) !== "BERLAKU") return false;
    if (!(await klaimToken(tx, t.id, sekarang))) return false;
    await tx.pengguna.update({ where: { id: t.penggunaId }, data: { emailTerverifikasiPada: sekarang } });
    return true;
  });
  if (!ok) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "VERIF_GAGAL" });
}

// ── Masuk ──────────────────────────────────────────────────────────────────

export async function masuk(
  m: { email: string; sandi: string },
  ip: string,
  sekarang: Date = new Date(),
): Promise<{ token: string; keluaran: z.infer<typeof AuthMasukKeluaran> }> {
  const email = normalisasiEmail(m.email);
  await wajibDalamBatas("MASUK", `${hashIp(ip)}:${hashEmail(email)}`, sekarang);
  const p = await denganAuth((tx) =>
    tx.pengguna.findUnique({ where: { email }, select: { id: true, sandiHash: true, emailTerverifikasiPada: true, dihapusPada: true } }),
  );
  const cocok = await cocokSandi(p && !p.dihapusPada ? p.sandiHash : null, m.sandi);
  if (!p || !cocok) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "MASUK_SALAH" });
  if (!p.emailTerverifikasiPada) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "MASUK_BELUM_VERIFIKASI" });

  return denganAuth(async (tx) => {
    const riwayat = await tx.persetujuanPdp.findMany({ where: { penggunaId: p.id }, select: { jenis: true, pada: true } });
    if (!persetujuanBerlaku(riwayat)) throw new GalatApi("PERAN_TIDAK_BOLEH", { kunciPesan: "AKUN_TARIK_PERINGATAN" });
    const anggota = await tx.keanggotaan.findMany({
      where: { penggunaId: p.id },
      select: { organisasiId: true, peran: true, aktif: true, dibuatPada: true },
    });
    const awal = pilihKonteksAwal(anggota);
    const { token } = await buatSesi(tx, { penggunaId: p.id, organisasiAktifId: awal?.organisasiId ?? null, peranAktif: awal?.peran ?? null }, sekarang);
    return { token, keluaran: { sesi: { organisasi: await organisasiPengguna(tx, p.id), peranAktif: awal?.peran ?? null } } };
  });
}

// ── Lupa & reset sandi ─────────────────────────────────────────────────────

/** Selalu selesai tanpa galat (respons {ok}) — tidak membocorkan keberadaan email maupun batas laju. */
export async function lupaSandi(emailMasukan: string, sekarang: Date = new Date()): Promise<void> {
  const email = normalisasiEmail(emailMasukan);
  if ((await hitungBatasLaju("LUPA", hashEmail(email), sekarang)) !== null) return;
  const token = buatToken();
  const ada = await denganAuth(async (tx) => {
    const p = await tx.pengguna.findUnique({ where: { email }, select: { id: true, dihapusPada: true } });
    if (!p || p.dihapusPada) return false;
    await tx.tokenSekali.create({
      data: {
        jenis: "RESET_SANDI",
        tokenHash: hashToken(token),
        penggunaId: p.id,
        emailTujuanHash: hashEmail(email),
        kedaluwarsaPada: kedaluwarsaToken("RESET_SANDI", sekarang),
      },
    });
    return true;
  });
  if (ada) {
    // Respons lupa-sandi selalu sama (tidak membocorkan akun); kegagalan kirim email dicatat, bukan 500.
    try {
      await pengirim().kirim(susunEmail(email, templatReset(tautan("/reset", token))));
    } catch (e) {
      log().warn("email reset sandi gagal terkirim", { galat: e });
    }
  }
}

/** Reset sandi: token 1 jam, sekali pakai; semua sesi pengguna dicabut. */
export async function resetSandi(token: string, sandi: string, sekarang: Date = new Date()): Promise<void> {
  const sandiHash = await hashSandi(sandi);
  const ok = await denganAuth(async (tx) => {
    const t = await tx.tokenSekali.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!t || t.jenis !== "RESET_SANDI" || !t.penggunaId || statusToken(t, sekarang) !== "BERLAKU") return false;
    const p = await tx.pengguna.findUnique({ where: { id: t.penggunaId }, select: { dihapusPada: true, emailTerverifikasiPada: true } });
    if (!p || p.dihapusPada) return false;
    if (!(await klaimToken(tx, t.id, sekarang))) return false;
    // Membuka tautan dari kotak masuk membuktikan kepemilikan email.
    await tx.pengguna.update({ where: { id: t.penggunaId }, data: { sandiHash, emailTerverifikasiPada: p.emailTerverifikasiPada ?? sekarang } });
    await cabutSemuaSesi(tx, t.penggunaId, sekarang);
    return true;
  });
  if (!ok) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "VERIF_GAGAL" });
}

// ── Undangan ───────────────────────────────────────────────────────────────

async function wajibPengurusAktif(tx: Tx, sesi: Sesi): Promise<string> {
  if (!sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const pengurus = await tx.keanggotaan.findFirst({
    where: { penggunaId: sesi.penggunaId, organisasiId: sesi.organisasiAktifId, pengurus: true, aktif: true },
    select: { id: true },
  });
  if (!pengurus) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return sesi.organisasiAktifId;
}

export { wajibPengurusAktif };

/** Undang ke organisasi AKTIF sesi saja (tidak ada parameter organisasi). Token 7 hari; email tujuan hanya disimpan sidiknya. */
export async function undang(sesi: Sesi, m: { email: string; peran: Exclude<Peran, "ADMIN"> }, sekarang: Date = new Date()): Promise<{ kadaluwarsaPada: string }> {
  const token = buatToken();
  const email = normalisasiEmail(m.email);
  const info = await denganAkses(konteksAkses(sesi), async (tx) => {
    const organisasiId = await wajibPengurusAktif(tx, sesi);
    const org = await tx.organisasi.findUnique({ where: { id: organisasiId }, select: { nama: true, jenis: true } });
    if (!org || !peranCocokJenis(org.jenis, m.peran)) {
      throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["peran"], kode: "tidak_sesuai_jenis_organisasi" }] });
    }
    const kedaluwarsaPada = kedaluwarsaToken("UNDANGAN", sekarang);
    await tx.tokenSekali.create({
      data: { jenis: "UNDANGAN", tokenHash: hashToken(token), organisasiId, peran: m.peran, emailTujuanHash: hashEmail(email), kedaluwarsaPada },
    });
    return { kedaluwarsaPada, nama: org.nama };
  });
  await pengirim().kirim(susunEmail(email, templatUndangan(tautan("/undangan", token), info.nama, `PERAN_${m.peran}`)));
  return { kadaluwarsaPada: info.kedaluwarsaPada.toISOString() };
}

type HasilTerima = { organisasiId: string; peran: Peran; tokenSesi: string | null };

async function ambilUndangan(tx: Tx, token: string, sekarang: Date) {
  const t = await tx.tokenSekali.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!t || t.jenis !== "UNDANGAN" || !t.organisasiId || !t.peran || statusToken(t, sekarang) !== "BERLAKU") {
    throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "VERIF_GAGAL" });
  }
  return { id: t.id, organisasiId: t.organisasiId, peran: t.peran, emailTujuanHash: t.emailTujuanHash };
}

/**
 * Terima undangan. Dengan sesi: email akun harus sama dengan email undangan. Tanpa sesi: buat akun baru
 * (persetujuan PDP lebih dulu, email langsung terverifikasi karena tautan datang dari kotak masuknya) lalu masuk.
 */
export async function terimaUndangan(
  sesi: Sesi | null,
  m: { token: string; email?: string; sandi?: string; persetujuanVersi?: string },
  sekarang: Date = new Date(),
): Promise<HasilTerima> {
  if (sesi) {
    return denganAuth(async (tx) => {
      const u = await ambilUndangan(tx, m.token, sekarang);
      const p = await tx.pengguna.findUnique({ where: { id: sesi.penggunaId }, select: { email: true } });
      if (!p?.email || hashEmail(p.email) !== u.emailTujuanHash) throw new GalatApi("PERAN_TIDAK_BOLEH");
      if (!(await klaimToken(tx, u.id, sekarang))) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "VERIF_GAGAL" });
      await tx.keanggotaan.upsert({
        where: { penggunaId_organisasiId_peran: { penggunaId: sesi.penggunaId, organisasiId: u.organisasiId, peran: u.peran } },
        create: { penggunaId: sesi.penggunaId, organisasiId: u.organisasiId, peran: u.peran, aktif: true },
        update: { aktif: true },
      });
      return { organisasiId: u.organisasiId, peran: u.peran, tokenSesi: null };
    });
  }

  if (!m.email || !m.sandi || !m.persetujuanVersi) {
    throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["email"], kode: "wajib_tanpa_sesi" }] });
  }
  const email = normalisasiEmail(m.email);
  const sandiHash = await hashSandi(m.sandi);
  const versi = m.persetujuanVersi;
  return denganAuth(async (tx) => {
    const u = await ambilUndangan(tx, m.token, sekarang);
    if (hashEmail(email) !== u.emailTujuanHash) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "VERIF_GAGAL" });
    // Akun sudah ada → pengguna masuk dulu lalu menerima dengan sesi.
    if (await tx.pengguna.findUnique({ where: { email }, select: { id: true } })) {
      throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["email"], kode: "akun_sudah_ada" }] });
    }
    await wajibTeksPersetujuan(tx, versi);
    const id = idBaru();
    await buatPenggunaDenganPersetujuan(tx, { id, email, sandiHash, versi, terverifikasiPada: sekarang, sekarang });
    if (!(await klaimToken(tx, u.id, sekarang))) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "VERIF_GAGAL" });
    await tx.keanggotaan.create({ data: { penggunaId: id, organisasiId: u.organisasiId, peran: u.peran, aktif: true } });
    const { token } = await buatSesi(tx, { penggunaId: id, organisasiAktifId: u.organisasiId, peranAktif: u.peran }, sekarang);
    return { organisasiId: u.organisasiId, peran: u.peran, tokenSesi: token };
  });
}
