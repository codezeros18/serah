import type { Guard } from "./jenis.ts";
import { diperiksa } from "./util.ts";

// (m) Berkas .env tidak boleh ter-track git (kecuali .env.example).

export const guardEnvTertrack: Guard = {
  kode: "m",
  nama: "env-tertrack",
  keterangan: ".env* ter-track git (selain .env.example)",
  periksa(k) {
    return diperiksa(
      k.tertrack
        .filter((j) => {
          const nama = j.split("/").pop() ?? "";
          return /^\.env(\..+)?$/.test(nama) && nama !== ".env.example";
        })
        .map((j) => ({ berkas: j, pesan: "berkas env ter-track git — hapus dari indeks (git rm --cached)" })),
    );
  },
};
