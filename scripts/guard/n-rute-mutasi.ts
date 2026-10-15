import type { Berkas, Guard, Temuan } from "./jenis.ts";
import { adalahTest, bersihkanKode, diperiksa, dilewati, nomorBaris } from "./util.ts";

// (n) Setiap route handler mutasi (POST/PUT/PATCH/DELETE) di apps/web/app/api memeriksa peran SESUAI kontrak
// (S26-5, CLAUDE.md §2.6, BLUEPRINT §P.1):
// 1. Rute ada di kontrak (`rute({ metode, jalur, akses })` di packages/kontrak/src/api).
// 2. Akses berisi peran → handler memanggil `wajibPeran(sesi, …)` dengan himpunan peran PERSIS sama
//    (rute ADMIN boleh lewat `dalamAdmin(`, yang memeriksa ADMIN + X-Alasan + Origin).
// 3. Akses tanpa peran → rute WAJIB tercantum di IZIN_TANPA_PERAN (daftar eksplisit + alasannya), dan:
//    SESI/PENGURUS → `wajibSesi(`; CRON → `wajibCron(`; WEBHOOK/PUBLIK → pemeriksaan sendiri (tanda tangan, token, batas laju).
// 4. Setiap mutasi memanggil `cekAsal(` (CSRF, §P.1) kecuali WEBHOOK & CRON (punya verifikasi sendiri).
// Entri izin yang tidak lagi cocok dengan kontrak/berkas juga dilaporkan, agar daftar tidak membusuk.

const PERAN = ["PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA", "ADMIN"] as const;
const AKAR_RUTE = "apps/web/app";
const AKAR_KONTRAK = "packages/kontrak/src/api/";

/** Mutasi tanpa peran yang DIIZINKAN, dengan alasannya. Kunci: "METODE /jalur". */
export const IZIN_TANPA_PERAN: Readonly<Record<string, string>> = {
  // Verifikasi sendiri (bukan sesi):
  "POST /api/webhook/midtrans": "tanda tangan penyedia (adaptor bayar)",
  "POST /api/cron/sepuluh-menit": "Bearer CRON_SECRET (wajibCron)",
  "POST /api/cron/tiga-jam": "Bearer CRON_SECRET (wajibCron)",
  "POST /api/cron/harian": "Bearer CRON_SECRET (wajibCron)",
  // Auth publik (belum ada sesi; batas laju & token sekali pakai):
  "POST /api/auth/daftar": "auth publik, batas laju DAFTAR",
  "POST /api/auth/masuk": "auth publik, batas laju MASUK",
  "POST /api/auth/lupa": "auth publik, batas laju LUPA",
  "POST /api/auth/reset": "auth publik, token sekali pakai",
  "POST /api/auth/verifikasi": "auth publik, token sekali pakai",
  "POST /api/auth/demo": "hanya DEMO_MODE=true",
  "POST /api/undangan/terima": "token undangan sekali pakai (sesi opsional)",
  // Milik sesi itu sendiri, tidak bergantung peran organisasi:
  "POST /api/auth/keluar": "sesi sendiri",
  "POST /api/akun/hapus": "akun sendiri",
  "PUT /api/akun/notifikasi": "preferensi sendiri",
  "POST /api/akun/tarik-persetujuan": "persetujuan sendiri",
  "POST /api/notifikasi/[id]/baca": "status baca pribadi",
  "POST /api/notifikasi/baca-semua": "status baca pribadi",
  "POST /api/push/langganan": "perangkat sendiri",
  "DELETE /api/push/langganan": "perangkat sendiri",
  "POST /api/sesi/organisasi": "pindah organisasi milik sendiri",
  "POST /api/organisasi": "membuat organisasi baru (belum punya peran)",
  "POST /api/foto": "peran diperiksa per jenis foto di layanan",
  "POST /api/sinkron": "peran diperiksa per operasi di layanan",
  // Pengurus organisasi (diperiksa wajibPengurusAktif di layanan; pengurus bisa berperan apa saja):
  "POST /api/anggota/[id]/nonaktif": "pengurus (wajibPengurusAktif)",
  "POST /api/organisasi/izin": "pengurus (wajibPengurusAktif)",
  "PATCH /api/organisasi/saya": "pengurus (wajibPengurusAktif)",
  "POST /api/undangan": "pengurus (wajibPengurusAktif)",
};

/** Rute SESI yang sengaja TIDAK mewajibkan sesi sah (tetap sukses tanpa sesi). */
export const SESI_OPSIONAL: Readonly<Record<string, string>> = {
  "POST /api/auth/keluar": "idempoten: tanpa sesi tetap menghapus cookie (bacaSesi)",
};

type RuteKontrak = { akses: string[]; berkas: string; baris: number };

const POLA_KONTRAK = /metode:\s*"(POST|PUT|PATCH|DELETE)",\s*jalur:\s*"([^"]+)",[^\n]*?akses:\s*\[([^\]]*)\]/g;
const POLA_HANDLER = /export\s+(?:const\s+|async\s+function\s+)(POST|PUT|PATCH|DELETE)\b/g;
const POLA_EKSPOR = /export\s+(?:const|async\s+function|function)\s+\w+/g;
const POLA_WAJIB_PERAN = /wajibPeran\(\s*\w+\s*((?:,\s*"[A-Z_]+"\s*)+)\)/g;

function bacaKontrak(berkas: readonly Berkas[]): Map<string, RuteKontrak> {
  const peta = new Map<string, RuteKontrak>();
  for (const b of berkas) {
    if (!b.jalur.startsWith(AKAR_KONTRAK) || !b.jalur.endsWith(".ts") || adalahTest(b.jalur)) continue;
    for (const m of b.isi.matchAll(POLA_KONTRAK)) {
      const akses = [...m[3]!.matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]!);
      peta.set(`${m[1]} ${m[2]}`, { akses, berkas: b.jalur, baris: nomorBaris(b.isi, m.index ?? 0) });
    }
  }
  return peta;
}

/** apps/web/app/api/x/[y]/route.ts → /api/x/[y] (grup rute "(…)" dibuang). */
export function jalurRute(berkas: string): string | null {
  if (!berkas.startsWith(`${AKAR_RUTE}/api/`) || !berkas.endsWith("/route.ts")) return null;
  const tengah = berkas.slice(AKAR_RUTE.length, -"/route.ts".length);
  return tengah
    .split("/")
    .filter((s) => !/^\(.*\)$/.test(s))
    .join("/");
}

/** Potongan kode tiap handler mutasi: dari `export` handler sampai `export` berikutnya. */
function potongHandler(kode: string): { metode: string; isi: string; indeks: number }[] {
  const awal = [...kode.matchAll(POLA_EKSPOR)].map((m) => m.index ?? 0);
  const hasil: { metode: string; isi: string; indeks: number }[] = [];
  for (const m of kode.matchAll(POLA_HANDLER)) {
    const i = m.index ?? 0;
    const akhir = awal.find((x) => x > i) ?? kode.length;
    hasil.push({ metode: m[1]!, isi: kode.slice(i, akhir), indeks: i });
  }
  return hasil;
}

const samaHimpunan = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export const guardRuteMutasi: Guard = {
  kode: "n",
  nama: "rute-mutasi",
  keterangan: "Rute mutasi memeriksa peran sesuai kontrak (wajibPeran/dalamAdmin) & Origin; pengecualian hanya daftar izin eksplisit",
  periksa(k) {
    const kontrak = bacaKontrak(k.berkas);
    if (kontrak.size === 0) return dilewati("kontrak rute belum ada");
    const temuan: Temuan[] = [];
    const terlihat = new Set<string>();

    for (const b of k.berkas) {
      const jalur = jalurRute(b.jalur);
      if (!jalur) continue;
      const kode = bersihkanKode(b.isi);
      for (const h of potongHandler(kode)) {
        const kunci = `${h.metode} ${jalur}`;
        terlihat.add(kunci);
        const baris = nomorBaris(kode, h.indeks);
        const tambah = (pesan: string) => temuan.push({ berkas: b.jalur, baris, pesan: `${kunci}: ${pesan}` });
        const r = kontrak.get(kunci);
        if (!r) {
          tambah("tidak ada di kontrak (packages/kontrak/src/api)");
          continue;
        }
        const peran = r.akses.filter((a) => (PERAN as readonly string[]).includes(a));
        const adalahAdmin = samaHimpunan(peran, ["ADMIN"]) && h.isi.includes("dalamAdmin(");

        if (peran.length > 0) {
          const panggilan = [...h.isi.matchAll(POLA_WAJIB_PERAN)].map((m) => [...m[1]!.matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]!));
          if (!adalahAdmin && !panggilan.some((p) => samaHimpunan(p, peran))) {
            tambah(panggilan.length === 0 ? `tanpa wajibPeran (kontrak: ${peran.join(", ")})` : `wajibPeran(${panggilan.map((p) => p.join("|")).join("; ")}) ≠ kontrak (${peran.join(", ")})`);
          }
          if (IZIN_TANPA_PERAN[kunci]) tambah("tercantum di IZIN_TANPA_PERAN padahal kontrak menyebut peran — hapus dari daftar izin");
        } else {
          if (!IZIN_TANPA_PERAN[kunci]) tambah(`tanpa peran di kontrak (${r.akses.join(", ")}) tetapi tidak tercantum di IZIN_TANPA_PERAN`);
          if ((r.akses.includes("SESI") || r.akses.includes("PENGURUS")) && !r.akses.includes("PUBLIK") && !SESI_OPSIONAL[kunci] && !h.isi.includes("wajibSesi(")) tambah("akses SESI/PENGURUS tanpa wajibSesi");
          if (r.akses.includes("CRON") && !h.isi.includes("wajibCron(")) tambah("rute CRON tanpa wajibCron");
        }

        const bebasAsal = r.akses.includes("WEBHOOK") || r.akses.includes("CRON");
        if (!bebasAsal && !h.isi.includes("cekAsal(") && !adalahAdmin) tambah("mutasi tanpa cekAsal (CSRF Origin)");
      }
    }

    for (const kunci of Object.keys(IZIN_TANPA_PERAN)) {
      if (!terlihat.has(kunci)) temuan.push({ berkas: "scripts/guard/n-rute-mutasi.ts", pesan: `IZIN_TANPA_PERAN memuat ${kunci} yang tidak ada sebagai handler` });
    }
    return diperiksa(temuan);
  },
};
