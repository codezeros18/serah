import { TEKS, isi, type KunciTeks } from "@serah/kontrak";
import type { PesanEmail } from "./index";

// Templat email tersusun HANYA dari teks.ts (§M) dan tautan. Tidak ada literal kalimat di berkas ini.

export type Bagian = { teks: KunciTeks; nilai?: Record<string, string | number> } | { tautan: string };
export type Templat = { judul: Bagian; isi: Bagian[] };

function render(b: Bagian): string {
  if ("tautan" in b) return b.tautan;
  const templat: string = TEKS[b.teks];
  return templat.replace(/\{([a-z0-9_]+)\}/g, (_m, nama: string) => {
    const v = b.nilai?.[nama];
    if (v === undefined) throw new Error(`Placeholder {${nama}} untuk ${b.teks} tidak diisi`);
    return String(v);
  });
}

export function susunEmail(ke: string, t: Templat): PesanEmail {
  return {
    ke,
    subjek: isi("EMAIL_SUBJEK_NOTIFIKASI", { judul: render(t.judul) }),
    teks: t.isi.map(render).join("\n\n"),
  };
}

export function templatVerifikasi(tautan: string): Templat {
  return { judul: { teks: "DAFTAR_JUDUL" }, isi: [{ teks: "DAFTAR_CEK_EMAIL" }, { tautan }, { teks: "EMAIL_KAKI" }] };
}

export function templatReset(tautan: string): Templat {
  return { judul: { teks: "RESET_JUDUL" }, isi: [{ teks: "RESET_JUDUL" }, { tautan }, { teks: "EMAIL_KAKI" }] };
}

export function templatUndangan(tautan: string, namaOrganisasi: string, kunciPeran: KunciTeks): Templat {
  return {
    judul: { teks: "UND_JUDUL" },
    isi: [
      { teks: "UND_PENJELASAN", nilai: { nama_organisasi: namaOrganisasi, peran: TEKS[kunciPeran] } },
      { teks: "UND_TERIMA" },
      { tautan },
      { teks: "AGT_UNDANGAN_TERKIRIM" },
    ],
  };
}

/** Notifikasi umum: kunci NTF_* + nilainya (judul = kalimat notifikasi itu sendiri). */
export function templatNotifikasi(kunci: KunciTeks, nilai: Record<string, string | number>, tautan?: string): Templat {
  const kalimat: Bagian = { teks: kunci, nilai };
  return { judul: kalimat, isi: [kalimat, ...(tautan ? [{ tautan }] : []), { teks: "EMAIL_KAKI" }] };
}

export function templatTagihan(nomor: string, jumlahRupiah: string, tautan?: string): Templat {
  return templatNotifikasi("NTF_TAGIHAN_TERBIT", { nomor, jumlah: jumlahRupiah }, tautan);
}
