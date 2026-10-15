// Daftar izin guard (b) kata terlarang — PERSIS, dan hanya ini (CLAUDE.md §2.8).
// Kalimat yang sama persis boleh muncul di berkas yang disebut; pengecualian lain hanya lewat entri [Kit].

export type IzinKata = { kunci: string; kalimat: string; berkas: readonly string[] };

export const IZIN_KATA: readonly IzinKata[] = [
  {
    kunci: "TENTANG_BATASAN_5",
    kalimat: "Tidak menjamin banjir tidak terjadi.",
    berkas: ["packages/kontrak/src/teks.ts", "README.md"],
  },
  {
    kunci: "TENTANG_BATASAN_7",
    kalimat: "Tidak menyatakan siapa pun melanggar hukum; hanya menolak langkah yang tidak sesuai dan menyebut rujukannya.",
    berkas: ["packages/kontrak/src/teks.ts", "README.md"],
  },
];
