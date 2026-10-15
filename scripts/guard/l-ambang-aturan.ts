import type { Guard } from "./jenis.ts";
import { adalahKode, adalahTest, bersihkanKode, diperiksa, temukan } from "./util.ts";

// (l) Ambang aturan hanya di packages/core/aturan/konfigurasi.ts (CLAUDE.md §2.3).
// Heuristik: literal angka 72, 24, 12, 2000, 6 di packages/core/aturan/** selain konfigurasi.ts.

const AKAR = "packages/core/aturan/";
const KONFIGURASI = "packages/core/aturan/konfigurasi.ts";
const POLA = /(?<![\w.$])(72|24|12|2_?000|6)(?![\w.])/g;

export const guardAmbangAturan: Guard = {
  kode: "l",
  nama: "ambang-aturan",
  keterangan: "Angka ambang (72/24/12/2000/6) di core/aturan selain konfigurasi.ts",
  periksa(k) {
    return diperiksa(
      k.berkas
        .filter((b) => b.jalur.startsWith(AKAR) && b.jalur !== KONFIGURASI && adalahKode(b.jalur) && !adalahTest(b.jalur))
        .flatMap((b) =>
          temukan(b, bersihkanKode(b.isi, { kosongkanString: true }), POLA, (m) => `literal ${m[1]} — ambil ambang dari konfigurasi.ts`),
        ),
    );
  },
};
