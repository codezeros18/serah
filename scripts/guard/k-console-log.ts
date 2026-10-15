import type { Guard } from "./jenis.ts";
import { adalahKode, bersihkanKode, diperiksa, temukan } from "./util.ts";

// (k) Nol console.log di luar scripts/ (CLAUDE.md §9). Log aplikasi lewat pino.

export const guardConsoleLog: Guard = {
  kode: "k",
  nama: "console-log",
  keterangan: "console.log hanya di scripts/",
  periksa(k) {
    return diperiksa(
      k.berkas
        .filter((b) => adalahKode(b.jalur) && !b.jalur.startsWith("scripts/"))
        .flatMap((b) => temukan(b, bersihkanKode(b.isi), /\bconsole\s*\.\s*log\s*\(/g, () => "console.log di luar scripts/")),
    );
  },
};
