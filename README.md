# SERAH

**Satu serah, tiga laporan.**

SERAH adalah aplikasi web (PWA) untuk pengelola kawasan — pasar swasta, food court, pusat kuliner, dan apartemen — yang wajib mencatat dan melaporkan sampahnya. Petugas TPS mencatat sampah per wadah warna. Setiap kali sampah diserahkan, satu catatan serah-terima ditutup bersama oleh pengelola kawasan, pengangkut, dan penerima. Dari catatan yang sama itu tersusun laporan ketiga pihak, sehingga angkanya selalu cocok.

> Sampah yang berpindah tangan cukup dicatat sekali, ditutup oleh yang menerimanya, dan catatan itu sekaligus menjadi laporan wajib ketiga pihak.

Dibuat untuk **Hackathon JOINTS × INSPIRE 2026 (UGM)** · Tema **Sustainability** · Subtema: pasar tradisional, UMKM kuliner, dan rumah tangga yang menghasilkan sampah non-organik yang belum dikelola optimal.

**Demo:** {URL produksi} · **Halaman demo empat panel:** {URL produksi}/demo

---

## Masalah

Peraturan Gubernur DKI Jakarta Nomor 102 Tahun 2021 mewajibkan kawasan dan perusahaan mengelola sampahnya sendiri: memilah ke empat wadah, mencatat berat sampah terpilah setiap hari di TPS, memastikan hanya residu yang dibawa ke TPA, dan melaporkan jenis, berat, pengangkut, tujuan, serta manifes pengangkutan. Kewajiban lapor yang sama berlaku bagi jasa pengangkutan dan jasa pengolahan.

Kenyataannya, satu kejadian fisik — sampah berpindah dari TPS ke truk ke penerima — dicatat tiga kali oleh tiga pihak, sering di kertas, lalu disalin ke portal di akhir bulan. Angkanya bisa tidak cocok, dan sampah daur ulang yang ditolak penerima karena kotor tidak pernah kembali ke TPS asal bersama alasannya.

## Cara kerja

1. **Petugas TPS** memindai QR TPS, memilih warna wadah (Hijau — Mudah terurai · Kuning — Dapat didaur ulang · Merah — B3 rumah tangga · Abu-abu — Residu), mengisi berat, menyimpan. Tetap jalan saat sinyal hilang.
2. **SERAH** menghitung umur wadah dan membaca prakiraan serta peringatan cuaca BMKG. TPS dengan wadah plastik yang sudah lama menunggu dan hujan lebat diprakirakan naik ke **prioritas angkut**.
3. **Pengangkut** memindai QR serah, memotret muatan, memilih kendaraan dan penerima dari kontrak. Langkah yang tidak sesuai aturan ditolak di layar beserta pasal rujukannya — misalnya sampah daur ulang tidak dapat dibawa ke TPA.
4. **Pengelola kawasan** menyetujui pengangkutan.
5. **Penerima** memotret tiket timbang; angkanya dibaca otomatis lalu **dikonfirmasi manusia**. Penerima menerima seluruhnya, sebagian (dengan alasan baku per aliran), atau menolak.
6. Serah tertutup → **tiga laporan** (kawasan, pengangkut, penerima) diperbarui dari data yang sama, layar ketiga pihak berubah seketika, dan rantai catatan bertambah satu sidik.

Pendukung: penyebab ditolak beserta perkiraan selisih nilai material · ekspor CSV/PDF · Lembar Neraca Bulanan berjejak asal · permintaan koreksi tanpa mengubah catatan asli · verifikasi rantai catatan · pelapak berizin sebagai penerima resmi · tagihan angkut dari serah yang tertutup · mode bayangan · notifikasi in-app, push, dan email · langganan (pembayaran mode uji).

## Aturan yang dijalankan sistem

| Kode | Rujukan | Perilaku |
|---|---|---|
| R-01 | Pergub DKI 102/2021 Ps. 20(2)(d) | Menolak muatan selain residu ke TPA/TPST |
| R-02 | Ps. 20(2)(b) | Menolak tujuan tanpa kontrak berlaku untuk aliran yang dibawa |
| R-03 | Ps. 19(2)(c) | Menolak penerima yang tidak menerima aliran tersebut |
| R-04 | Integritas bukti | Menolak foto muatan yang sangat mirip foto sebelumnya |
| R-05, R-06 | Ps. 8(1)(g)–(h) | Peringatan wadah melewati daya tampung 3 hari / 1 hari |
| R-07 | Integritas serah | Menandai serah yang belum ditutup penerima >12 jam |
| R-08 | Integritas berat | Peringatan selisih berat tiket vs catatan TPS >20% |
| R-09 | Ps. 13(4)(a) | Peringatan TPS tanpa catatan harian |
| R-10 | Data BMKG + Ps. 8 | Prioritas angkut (bukan peringatan dini resmi) |
| R-11 | Ps. 1 angka 21 | Kontrak dan serah ke penerima yang izinnya belum terverifikasi tidak dapat dilanjutkan |

Kutipan pasal merupakan rujukan, bukan pendapat hukum.

## Yang tidak dilakukan SERAH

- Tidak melacak lokasi orang atau kendaraan.
- Tidak menimbang; berat berasal dari catatan TPS dan tiket timbang penerima.
- Tidak menaksir berat atau jenis sampah dari foto.
- Tidak membuat prakiraan cuaca sendiri; memakai data BMKG.
- Tidak menjamin banjir tidak terjadi.
- Tidak menyimpan data per pedagang, petugas, sopir, atau pemulung, dan tidak memberi nilai kepada siapa pun.
- Tidak menyatakan siapa pun melanggar hukum; hanya menolak langkah yang tidak sesuai dan menyebut rujukannya.
- Tidak mengirim laporan ke sistem pemerintah secara otomatis.
- Tidak menangani limbah B3 industri.
- Tidak memberi nasihat hukum.

SERAH bukan portal pelaporan pemerintah. SERAH menyiapkan berkas yang Anda laporkan melalui sistem Dinas Lingkungan Hidup.

## AI yang dipakai

**Dalam produk:** satu pemakaian saja — membaca tiket/nota timbang dengan Claude Haiku 5.5 (`claude-haiku-5-5`) melalui structured output, dengan Claude Sonnet 5.5 (`claude-sonnet-5-5`) sebagai cadangan. Hasilnya selalu berlabel, diperiksa, dan dikonfirmasi manusia sebelum tercatat; isian manual selalu tersedia. Aturan, status, prioritas cuaca, deteksi foto ulang, dan laporan sepenuhnya deterministik.

**Dalam pengerjaan:** Claude (riset & dokumen) dan Claude Code (penulisan kode, test, dokumentasi){, Higgsfield (aset visual) — hanya bila dipakai}.

## Arsitektur

```
apps/web            Next.js 16 (App Router) — halaman, route handler, SSE, cron
packages/core       logika murni: mesin status, aturan R-01…R-11, rantai hash, laporan, neraca, hak paket
packages/kontrak    tipe & skema zod, enum, kode galat, seluruh teks antarmuka
packages/db         Prisma 7 + migrasi SQL (RLS, tabel catat-saja, fungsi verifikasi rantai)
packages/ui         token desain & komponen
```

- **Bukti tahan sengketa:** setiap transisi menjadi satu event berantai SHA-256 per kawasan; tabel bukti catat-saja (trigger + pencabutan hak); koreksi menyimpan nilai asli.
- **Isolasi data:** Row-Level Security per organisasi; role basis data aplikasi tanpa hak superuser.
- **Lapangan:** PWA offline-first (IndexedDB + sinkron idempoten), kamera langsung tanpa galeri, QR.
- **Waktu nyata:** PostgreSQL `LISTEN/NOTIFY` → Server-Sent Events.
- **Angka:** berat dalam gram dan uang dalam rupiah sebagai bilangan bulat.
- **Privasi:** tanpa GPS, metadata lokasi foto dibuang, data operasional menyimpan peran bukan nama.

## Menjalankan secara lokal

### Prasyarat
| | Versi |
|---|---|
| Node.js | 24 LTS |
| pnpm | 9 |
| Docker | untuk PostgreSQL lokal |

### Langkah
```bash
git clone https://github.com/{org}/serah.git
cd serah
pnpm install
cp .env.example .env          # isi TOKEN_PEPPER & SESI_SECRET (≥32 karakter acak); untuk mencoba: DEMO_MODE=true
pnpm db:up                    # PostgreSQL 16 di Docker (port host: SERAH_DB_PORT, bawaan 5432)
pnpm --filter @serah/db db:migrate
pnpm --filter @serah/db db:seed
pnpm dev                      # http://localhost:3000
```

Masuk ke `http://localhost:3000/masuk` dan pilih salah satu tombol akun demo (hanya saat `DEMO_MODE=true`), atau buka `http://localhost:3000/demo` untuk empat panel sekaligus.

### Akun demo (DEMO_MODE)
| Peran | Akun |
|---|---|
| Petugas TPS | `petugas@demo.serah.id` |
| Pengelola kawasan | `pengelola@demo.serah.id` |
| Pengangkut | `pengangkut@demo.serah.id` |
| Penerima | `penerima@demo.serah.id` |
| Admin | `admin@demo.serah.id` |

Semua nama kawasan, pengangkut, dan penerima di data demo adalah contoh.

### Variabel lingkungan
| Variabel | Untuk | Bila kosong |
|---|---|---|
| `DATABASE_URL` | Koneksi aplikasi (role tanpa superuser) | Gagal start |
| `DATABASE_URL_MIGRASI` | Migrasi | Migrasi tidak jalan |
| `BASE_URL` | Tautan & pemeriksaan asal permintaan | Gagal start |
| `TOKEN_PEPPER`, `SESI_SECRET` | Hash token & sesi (≥32 karakter) | Gagal start |
| `CRON_SECRET` | Pekerjaan terjadwal | Cron menolak |
| `DEMO_MODE` | Data & akun demo, `/demo` | `false` |
| `NEXT_PUBLIC_API_MOCK` | Data contoh di klien tanpa API | `false` |
| `PENYIMPANAN_MODE` | `lokal` / `r2` | `lokal` di dev; gagal start di produksi |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Penyimpanan foto | Wajib bila `r2` |
| `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_MODEL_CADANGAN` | Pembacaan tiket | Tanpa kunci: isian manual saja |
| `BMKG_MODE` | `live` / `snapshot` | `snapshot` |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` | Pembayaran mode uji (sandbox) | Hanya transfer manual; `MIDTRANS_IS_PRODUCTION=true` → gagal start |
| `TRANSFER_REKENING_TEKS` | Instruksi transfer | Tombol transfer disembunyikan |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email | Dev: dicetak ke terminal; produksi: gagal start |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notifikasi push | Push dimatikan |
| `SENTRY_DSN` | Pelaporan galat | Tidak dikirim |
| `RETENSI_FOTO_HARI` | Lama simpan foto | 180 |
| `EMAIL_KONTAK` | Kontak di kebijakan privasi | Gagal start di produksi |
| `PORT` | Port aplikasi | 3000 |
| `SERAH_DB_PORT` | Port host PostgreSQL Docker lokal | 5432 |

### Perintah
```bash
pnpm verify          # lint + typecheck + test + pemeriksaan struktural
pnpm test            # Vitest (unit & integrasi)
pnpm test:e2e        # Playwright (viewport HP & laptop); sekali: pnpm --filter @serah/web exec playwright install chromium
pnpm guard           # pemeriksaan struktural (batas impor, teks, privasi, tabel catat-saja, dll.)
pnpm build           # build produksi Next.js
pnpm db:up           # PostgreSQL 16 lokal di Docker
pnpm db:down         # hentikan PostgreSQL lokal
```

## Sumber data & atribusi

- **Sumber data cuaca: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)** — Data Prakiraan Cuaca Terbuka (per kelurahan/desa) dan Peringatan Dini Cuaca (nowcast, CAP). https://data.bmkg.go.id
- Peraturan Gubernur DKI Jakarta Nomor 102 Tahun 2021 tentang Kewajiban Pengelolaan Sampah di Kawasan dan Perusahaan — JDIH Provinsi DKI Jakarta.
- Harga material daur ulang yang ditampilkan berasal dari sumber publik yang disebut di layar beserta tanggalnya; harga di tempat Anda dapat berbeda.

## Privasi

Data pribadi yang diproses hanya email, kata sandi tersandi, organisasi & peran, catatan persetujuan, dan preferensi notifikasi. Persetujuan dicatat sebelum akun dibuat; pengguna dapat mengunduh datanya, menarik persetujuan, dan menghapus akun dari halaman Akun. Lihat `/privasi` di aplikasi.

## Status

Prototipe produksi untuk penyisihan Hackathon JOINTS × INSPIRE 2026. Pembayaran berjalan dalam mode uji (sandbox); tidak ada uang sungguhan yang ditarik.

© 2026 Tim SERAH. Kode ini merupakan karya asli tim untuk Hackathon JOINTS × INSPIRE 2026.
