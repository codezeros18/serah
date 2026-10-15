import type { Guard, Temuan } from "./jenis.ts";
import { adalahGuard, adalahKode, ambilImpor, bersihkanKode, diperiksa, nomorBaris } from "./util.ts";

// (g) SDK Anthropic hanya diimpor di apps/web/lib/adaptor/ai/** (CLAUDE.md §2.4).

const DIIZINKAN = "apps/web/lib/adaptor/ai/";

export const guardSdkAi: Guard = {
  kode: "g",
  nama: "sdk-ai",
  keterangan: "@anthropic-ai/sdk hanya di apps/web/lib/adaptor/ai",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!adalahKode(b.jalur) || adalahGuard(b.jalur) || b.jalur.startsWith(DIIZINKAN)) continue;
      for (const imp of ambilImpor(bersihkanKode(b.isi))) {
        if (imp.spesifier.startsWith("@anthropic-ai/")) {
          temuan.push({ berkas: b.jalur, baris: nomorBaris(b.isi, imp.indeks), pesan: `impor "${imp.spesifier}" di luar ${DIIZINKAN}` });
        }
      }
    }
    return diperiksa(temuan);
  },
};
