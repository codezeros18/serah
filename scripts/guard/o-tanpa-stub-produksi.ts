import type { Guard, Temuan } from "./jenis.ts";
import { adalahKode, adalahTest, ambilImpor, bersihkanKode, diperiksa, nomorBaris, temukan } from "./util.ts";

// (o) Jalur produksi tanpa mock & stub (S28-1). Kode di apps/web/{app,lib} yang BUKAN test:
// 1. tidak mengimpor lib/server/uji/** (stub & pembantu test) atau berkas bernama *integrasi-stub*;
// 2. tidak menyebut stub (pemrosesFotoStub, manualPembaca, cuacaTanpaJaringan);
// 3. membaca NEXT_PUBLIC_API_MOCK hanya di tempat yang diizinkan (klien API, berkas mock, validasi env).
// Mock klien (lib/klien/mock*.ts) hanya dimuat lewat `import()` dinamis di api.ts di balik bendera yang disisipkan
// saat build, sehingga tidak ikut bundel produksi; env.ts menolak start produksi bila bendera menyala.

const AKAR = /^apps\/web\/(app|lib)\//;
const IZIN_API_MOCK = new Set(["apps/web/lib/klien/api.ts", "apps/web/lib/server/env.ts"]);
const POLA_STUB = /\b(pemrosesFotoStub|manualPembaca|cuacaTanpaJaringan)\b/g;
const POLA_API_MOCK = /\bNEXT_PUBLIC_API_MOCK\b/g;

const adalahUji = (j: string) => j.startsWith("apps/web/lib/server/uji/");
const adalahMockKlien = (j: string) => /^apps\/web\/lib\/klien\/mock[^/]*\.ts$/.test(j);

export const guardTanpaStubProduksi: Guard = {
  kode: "o",
  nama: "tanpa-stub-produksi",
  keterangan: "Produksi tidak mengimpor lib/server/uji, tidak memakai stub, dan NEXT_PUBLIC_API_MOCK hanya di api.ts/mock/env.ts",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!AKAR.test(b.jalur) || !adalahKode(b.jalur) || adalahTest(b.jalur) || adalahUji(b.jalur)) continue;
      const kode = bersihkanKode(b.isi);
      for (const i of ambilImpor(kode)) {
        if (/\/uji\/|integrasi-stub|stub-integrasi/.test(i.spesifier)) {
          temuan.push({ berkas: b.jalur, baris: nomorBaris(kode, i.indeks), pesan: `kode produksi mengimpor "${i.spesifier}" (stub/pembantu test)` });
        }
      }
      if (!adalahMockKlien(b.jalur)) temuan.push(...temukan(b, kode, POLA_STUB, (m) => `kode produksi menyebut stub "${m[1]}"`));
      if (!IZIN_API_MOCK.has(b.jalur) && !adalahMockKlien(b.jalur)) temuan.push(...temukan(b, kode, POLA_API_MOCK, () => "NEXT_PUBLIC_API_MOCK dibaca di luar api.ts/mock/env.ts"));
    }
    return diperiksa(temuan);
  },
};
